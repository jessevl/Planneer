package main

import (
	"bytes"
	"encoding/xml"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"path"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/filesystem"
)

const (
	booxSourceOrigin       = "boox"
	booxNotebookItemType   = "notebook"
	booxRootCollectionType = "root"
	booxRootPageTitle      = "Boox Notes"
	maxBooxPDFSize         = 50 * 1024 * 1024
)

var booxHTTPClient = &http.Client{Timeout: 60 * time.Second}

type booxIntegrationPayload struct {
	Enabled       bool   `json:"enabled"`
	ServerURL     string `json:"serverUrl"`
	Username      string `json:"username"`
	Password      string `json:"password,omitempty"`
	RootPath      string `json:"rootPath"`
	ClearPassword bool   `json:"clearPassword,omitempty"`
}

type booxIntegrationResponse struct {
	Enabled        bool   `json:"enabled"`
	ServerURL      string `json:"serverUrl"`
	Username       string `json:"username"`
	RootPath       string `json:"rootPath"`
	HasPassword    bool   `json:"hasPassword"`
	LastSyncAt     string `json:"lastSyncAt"`
	LastSyncStatus string `json:"lastSyncStatus"`
	LastSyncError  string `json:"lastSyncError"`
	NotebookCount  int    `json:"notebookCount"`
	Configured     bool   `json:"configured"`
}

type booxSyncResponse struct {
	Config  booxIntegrationResponse `json:"config"`
	Created int                     `json:"created"`
	Updated int                     `json:"updated"`
	Deleted int                     `json:"deleted"`
	Total   int                     `json:"total"`
}

type booxSyncResult struct {
	Created int
	Updated int
	Deleted int
	Total   int
}

type webDAVMultistatus struct {
	Responses []webDAVResponse `xml:"response"`
}

type webDAVResponse struct {
	Href      string           `xml:"href"`
	PropStats []webDAVPropStat `xml:"propstat"`
}

type webDAVPropStat struct {
	Prop   webDAVProp `xml:"prop"`
	Status string     `xml:"status"`
}

type webDAVProp struct {
	GetContentType   string             `xml:"getcontenttype"`
	GetContentLength string             `xml:"getcontentlength"`
	GetLastModified  string             `xml:"getlastmodified"`
	CreationDate     string             `xml:"creationdate"`
	GetETag          string             `xml:"getetag"`
	ResourceType     webDAVResourceType `xml:"resourcetype"`
}

type webDAVResourceType struct {
	Collection *struct{} `xml:"collection"`
}

type booxRemoteNotebook struct {
	ExternalID  string
	RemotePath  string
	DownloadURL string
	Title       string
	Filename    string
	Size        int64
	CreatedAt   string
	ModifiedAt  string
	ETag        string
}

func registerBooxRoutes(app *pocketbase.PocketBase, se *core.ServeEvent) {
	se.Router.GET("/api/workspaces/{workspaceId}/boox-integration", func(e *core.RequestEvent) error {
		return handleGetBooxIntegration(e, app)
	}).Bind(apis.RequireAuth())

	se.Router.POST("/api/workspaces/{workspaceId}/boox-integration", func(e *core.RequestEvent) error {
		return handleUpsertBooxIntegration(e, app)
	}).Bind(apis.RequireAuth())

	se.Router.PUT("/api/workspaces/{workspaceId}/boox-integration", func(e *core.RequestEvent) error {
		return handleUpsertBooxIntegration(e, app)
	}).Bind(apis.RequireAuth())

	se.Router.POST("/api/workspaces/{workspaceId}/boox-integration/sync", func(e *core.RequestEvent) error {
		return handleSyncBooxIntegration(e, app)
	}).Bind(apis.RequireAuth())
}

func handleGetBooxIntegration(e *core.RequestEvent, app *pocketbase.PocketBase) error {
	workspaceId := e.Request.PathValue("workspaceId")
	if workspaceId == "" {
		return e.BadRequestError("Workspace ID is required", nil)
	}

	if _, err := requireWorkspaceMembership(app, workspaceId, e.Auth.Id); err != nil {
		return err
	}

	configRecord, _ := findBooxIntegrationRecord(app, workspaceId)
	return e.JSON(http.StatusOK, buildBooxIntegrationResponse(app, workspaceId, configRecord))
}

func handleUpsertBooxIntegration(e *core.RequestEvent, app *pocketbase.PocketBase) error {
	workspaceId := e.Request.PathValue("workspaceId")
	if workspaceId == "" {
		return e.BadRequestError("Workspace ID is required", nil)
	}

	if err := requireWorkspaceAdmin(app, workspaceId, e.Auth.Id); err != nil {
		return err
	}

	var body booxIntegrationPayload
	if err := e.BindBody(&body); err != nil {
		return e.BadRequestError("Invalid request body", err)
	}

	normalizedURL := strings.TrimSpace(body.ServerURL)
	if body.Enabled && normalizedURL == "" {
		return e.BadRequestError("Server URL is required when BOOX sync is enabled", nil)
	}
	if normalizedURL != "" {
		parsedURL, err := url.Parse(normalizedURL)
		if err != nil || parsedURL.Scheme == "" || parsedURL.Host == "" {
			return e.BadRequestError("Server URL must be a valid absolute URL", nil)
		}
	}

	configRecord, err := upsertBooxIntegrationRecord(app, workspaceId, body)
	if err != nil {
		return e.InternalServerError("Failed to save BOOX integration", err)
	}

	return e.JSON(http.StatusOK, buildBooxIntegrationResponse(app, workspaceId, configRecord))
}

func handleSyncBooxIntegration(e *core.RequestEvent, app *pocketbase.PocketBase) error {
	workspaceId := e.Request.PathValue("workspaceId")
	if workspaceId == "" {
		return e.BadRequestError("Workspace ID is required", nil)
	}

	if err := requireWorkspaceAdmin(app, workspaceId, e.Auth.Id); err != nil {
		return err
	}

	configRecord, err := findBooxIntegrationRecord(app, workspaceId)
	if err != nil || configRecord == nil {
		return e.BadRequestError("Configure BOOX integration before syncing", nil)
	}
	if !configRecord.GetBool("enabled") {
		return e.BadRequestError("BOOX sync is disabled for this workspace", nil)
	}

	result, syncErr := syncBooxWorkspace(app, workspaceId, configRecord)
	if syncErr != nil {
		configRecord.Set("lastSyncStatus", "error")
		configRecord.Set("lastSyncError", syncErr.Error())
		configRecord.Set("lastSyncAt", time.Now().UTC().Format(time.RFC3339))
		if saveErr := app.Save(configRecord); saveErr != nil {
			return e.InternalServerError("BOOX sync failed and status update could not be saved", saveErr)
		}
		return e.BadRequestError(syncErr.Error(), nil)
	}

	configRecord.Set("lastSyncStatus", "ok")
	configRecord.Set("lastSyncError", "")
	configRecord.Set("lastSyncAt", time.Now().UTC().Format(time.RFC3339))
	if err := app.Save(configRecord); err != nil {
		return e.InternalServerError("BOOX sync completed but status could not be saved", err)
	}

	return e.JSON(http.StatusOK, booxSyncResponse{
		Config:  buildBooxIntegrationResponse(app, workspaceId, configRecord),
		Created: result.Created,
		Updated: result.Updated,
		Deleted: result.Deleted,
		Total:   result.Total,
	})
}

func syncBooxWorkspace(app *pocketbase.PocketBase, workspaceId string, configRecord *core.Record) (booxSyncResult, error) {
	remoteNotebooks, err := listBooxRemoteNotebooks(configRecord)
	if err != nil {
		return booxSyncResult{}, err
	}

	rootPage, err := ensureBooxRootPage(app, workspaceId)
	if err != nil {
		return booxSyncResult{}, err
	}

	existingRecords, err := app.FindRecordsByFilter(
		"pages",
		"workspace = {:wid} && sourceOrigin = 'boox' && sourceItemType = 'notebook'",
		"order",
		0,
		0,
		map[string]any{"wid": workspaceId},
	)
	if err != nil {
		return booxSyncResult{}, err
	}

	existingByExternalID := make(map[string]*core.Record, len(existingRecords))
	for _, record := range existingRecords {
		existingByExternalID[record.GetString("sourceExternalId")] = record
	}

	pagesCollection, err := app.FindCollectionByNameOrId("pages")
	if err != nil {
		return booxSyncResult{}, err
	}

	seen := make(map[string]struct{}, len(remoteNotebooks))
	result := booxSyncResult{Total: len(remoteNotebooks)}
	now := time.Now().UTC().Format(time.RFC3339)

	for index, notebook := range remoteNotebooks {
		seen[notebook.ExternalID] = struct{}{}

		record, exists := existingByExternalID[notebook.ExternalID]
		recordChanged := false
		if !exists {
			record = core.NewRecord(pagesCollection)
			record.Set("workspace", workspaceId)
			record.Set("parentId", rootPage.Id)
			record.Set("viewMode", "note")
			record.Set("childrenViewMode", "gallery")
			record.Set("isDailyNote", false)
			record.Set("isExpanded", false)
			record.Set("showChildrenInSidebar", false)
			record.Set("content", "")
			record.Set("excerpt", "")
			record.Set("isReadOnly", true)
			record.Set("sourceOrigin", booxSourceOrigin)
			record.Set("sourceItemType", booxNotebookItemType)
			record.Set("sourceExternalId", notebook.ExternalID)
			recordChanged = true
			result.Created++
		}

		// Determine whether the PDF needs to be (re-)downloaded BEFORE updating
		// metadata fields on the record.  The comparison in booxNotebookNeedsFileRefresh
		// reads sourceModifiedAt / sourceContentLength / sourceETag from the record, so
		// it must run against the *stored* values, not the already-updated ones.
		sourceCreatedAt := notebook.CreatedAt
		if sourceCreatedAt == "" {
			sourceCreatedAt = notebook.ModifiedAt
		}
		sourceModifiedAt := notebook.ModifiedAt
		if sourceModifiedAt == "" {
			sourceModifiedAt = sourceCreatedAt
		}

		needsPDFRefresh := !exists || booxNotebookNeedsFileRefresh(record, notebook)

		// Now update metadata fields on the record.
		if setBooxTextFieldIfChanged(record, "title", notebook.Title) {
			recordChanged = true
		}
		if setBooxNumberFieldIfChanged(record, "order", index) {
			recordChanged = true
		}
		if setBooxTextFieldIfChanged(record, "sourcePath", notebook.RemotePath) {
			recordChanged = true
		}
		if setBooxTextFieldIfChanged(record, "sourceLastSyncedAt", now) {
			recordChanged = true
		}
		if setBooxTextFieldIfChanged(record, "sourceCreatedAt", sourceCreatedAt) {
			recordChanged = true
		}
		if setBooxTextFieldIfChanged(record, "sourceModifiedAt", sourceModifiedAt) {
			recordChanged = true
		}
		if setBooxTextFieldIfChanged(record, "sourceContentLength", formatBooxContentLength(notebook.Size)) {
			recordChanged = true
		}
		if setBooxTextFieldIfChanged(record, "sourceETag", notebook.ETag) {
			recordChanged = true
		}

		if needsPDFRefresh {
			pdfBytes, err := downloadBooxNotebook(configRecord, notebook)
			if err != nil {
				return booxSyncResult{}, fmt.Errorf("failed to download %s: %w", notebook.RemotePath, err)
			}

			pdfFile, err := filesystem.NewFileFromBytes(pdfBytes, notebook.Filename)
			if err != nil {
				return booxSyncResult{}, fmt.Errorf("failed to create local file for %s: %w", notebook.RemotePath, err)
			}

			record.Set("files", []*filesystem.File{pdfFile})
			generateAndAttachThumbnail(record, pdfBytes)
			recordChanged = true
		}

		if !recordChanged {
			continue
		}

		if err := app.Save(record); err != nil {
			return booxSyncResult{}, fmt.Errorf("failed to save mirrored notebook %s: %w", notebook.RemotePath, err)
		}
		if err := setBooxMirroredPageTimestamps(app, record.Id, sourceCreatedAt, sourceModifiedAt); err != nil {
			return booxSyncResult{}, fmt.Errorf("failed to update mirrored notebook timestamps for %s: %w", notebook.RemotePath, err)
		}
		if exists {
			result.Updated++
		}
	}

	for _, record := range existingRecords {
		externalID := record.GetString("sourceExternalId")
		if _, ok := seen[externalID]; ok {
			continue
		}
		if err := app.Delete(record); err != nil {
			return booxSyncResult{}, fmt.Errorf("failed to delete stale mirrored notebook %s: %w", record.Id, err)
		}
		result.Deleted++
	}

	if setBooxTextFieldIfChanged(rootPage, "sourceLastSyncedAt", now) {
		if err := app.Save(rootPage); err != nil {
			return booxSyncResult{}, fmt.Errorf("failed to update BOOX root sync status: %w", err)
		}
	}

	return result, nil
}

func ensureBooxRootPage(app *pocketbase.PocketBase, workspaceId string) (*core.Record, error) {
	record, err := app.FindFirstRecordByFilter(
		"pages",
		"workspace = {:wid} && sourceOrigin = 'boox' && sourceItemType = 'root'",
		map[string]any{"wid": workspaceId},
	)
	if err == nil {
		recordChanged := false
		if setBooxTextFieldIfChanged(record, "title", booxRootPageTitle) {
			recordChanged = true
		}
		if setBooxTextFieldIfChanged(record, "viewMode", "collection") {
			recordChanged = true
		}
		if setBooxTextFieldIfChanged(record, "childrenViewMode", "gallery") {
			recordChanged = true
		}
		if setBooxBoolFieldIfChanged(record, "showChildrenInSidebar", true) {
			recordChanged = true
		}
		if setBooxTextFieldIfChanged(record, "sourcePath", "/") {
			recordChanged = true
		}
		if setBooxBoolFieldIfChanged(record, "isReadOnly", true) {
			recordChanged = true
		}
		if recordChanged {
			if saveErr := app.Save(record); saveErr != nil {
				return nil, saveErr
			}
		}
		return record, nil
	}

	pagesCollection, err := app.FindCollectionByNameOrId("pages")
	if err != nil {
		return nil, err
	}

	record = core.NewRecord(pagesCollection)
	record.Set("workspace", workspaceId)
	record.Set("title", booxRootPageTitle)
	record.Set("content", "")
	record.Set("excerpt", "")
	record.Set("parentId", "")
	record.Set("order", 0)
	record.Set("viewMode", "collection")
	record.Set("childrenViewMode", "gallery")
	record.Set("isDailyNote", false)
	record.Set("isExpanded", true)
	record.Set("showChildrenInSidebar", true)
	record.Set("isReadOnly", true)
	record.Set("sourceOrigin", booxSourceOrigin)
	record.Set("sourceItemType", booxRootCollectionType)
	record.Set("sourceExternalId", "boox-root")
	record.Set("sourcePath", "/")

	if err := app.Save(record); err != nil {
		return nil, err
	}

	return record, nil
}

func listBooxRemoteNotebooks(configRecord *core.Record) ([]booxRemoteNotebook, error) {
	serverURL := strings.TrimSpace(configRecord.GetString("serverUrl"))
	rootPath := normalizeBooxRootPath(configRecord.GetString("rootPath"))
	rootRequestURL, err := joinURLPath(serverURL, rootPath)
	if err != nil {
		return nil, err
	}

	baseURL, err := url.Parse(serverURL)
	if err != nil {
		return nil, err
	}

	rootURL, err := url.Parse(rootRequestURL)
	if err != nil {
		return nil, err
	}

	var notebooks []booxRemoteNotebook
	visitedDirectories := map[string]struct{}{}
	pendingDirectories := []string{ensureTrailingSlash(rootRequestURL)}

	for len(pendingDirectories) > 0 {
		currentURL := pendingDirectories[0]
		pendingDirectories = pendingDirectories[1:]
		if _, seen := visitedDirectories[currentURL]; seen {
			continue
		}
		visitedDirectories[currentURL] = struct{}{}

		responses, err := propfindBooxDirectory(configRecord, currentURL)
		if err != nil {
			return nil, err
		}

		for _, response := range responses {
			prop := firstOKProp(response.PropStats)
			if prop == nil {
				continue
			}

			entryURL, err := resolveBooxRemoteURL(baseURL, response.Href)
			if err != nil {
				return nil, err
			}
			entryURL = stripURLFragment(entryURL)

			if sameRemoteResource(currentURL, entryURL) {
				continue
			}

			remotePath := normalizeRemoteFilePath(rootURL, entryURL)
			if remotePath == "" {
				continue
			}

			if prop.ResourceType.Collection != nil {
				directoryURL := ensureTrailingSlash(entryURL)
				if _, seen := visitedDirectories[directoryURL]; !seen {
					pendingDirectories = append(pendingDirectories, directoryURL)
				}
				continue
			}

			if !strings.HasSuffix(strings.ToLower(remotePath), ".pdf") {
				continue
			}

			size, _ := strconv.ParseInt(strings.TrimSpace(prop.GetContentLength), 10, 64)
			filename := sanitizeBooxFilename(path.Base(remotePath))
			title := strings.TrimSuffix(path.Base(remotePath), path.Ext(remotePath))
			if title == "" {
				title = filename
			}

			notebooks = append(notebooks, booxRemoteNotebook{
				ExternalID:  entryURL,
				RemotePath:  remotePath,
				DownloadURL: entryURL,
				Title:       title,
				Filename:    filename,
				Size:        size,
				CreatedAt:   normalizeBooxRemoteTimestamp(prop.CreationDate),
				ModifiedAt:  normalizeBooxRemoteTimestamp(prop.GetLastModified),
				ETag:        strings.TrimSpace(prop.GetETag),
			})
		}
	}

	sort.Slice(notebooks, func(i, j int) bool {
		return notebooks[i].RemotePath < notebooks[j].RemotePath
	})

	return notebooks, nil
}

func downloadBooxNotebook(configRecord *core.Record, notebook booxRemoteNotebook) ([]byte, error) {
	req, err := http.NewRequest(http.MethodGet, notebook.DownloadURL, nil)
	if err != nil {
		return nil, err
	}
	applyBooxAuth(req, configRecord)

	resp, err := booxHTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, fmt.Errorf("download failed for %s with status %d: %s", notebook.DownloadURL, resp.StatusCode, strings.TrimSpace(string(body)))
	}

	data, err := io.ReadAll(io.LimitReader(resp.Body, maxBooxPDFSize+1))
	if err != nil {
		return nil, err
	}
	if len(data) > maxBooxPDFSize {
		return nil, fmt.Errorf("%s exceeds the 50 MB page file limit", notebook.RemotePath)
	}
	if detectedType := http.DetectContentType(data); !strings.HasPrefix(detectedType, "application/pdf") {
		return nil, fmt.Errorf("%s is not a valid PDF", notebook.RemotePath)
	}

	return data, nil
}

func applyBooxAuth(req *http.Request, configRecord *core.Record) {
	username := configRecord.GetString("username")
	password := configRecord.GetString("password")
	if username != "" || password != "" {
		req.SetBasicAuth(username, password)
	}
}

func normalizeBooxRootPath(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "/"
	}
	if !strings.HasPrefix(raw, "/") {
		raw = "/" + raw
	}
	cleaned := path.Clean(raw)
	if cleaned == "." {
		return "/"
	}
	if !strings.HasPrefix(cleaned, "/") {
		cleaned = "/" + cleaned
	}
	return cleaned
}

func sanitizeBooxFilename(filename string) string {
	filename = strings.TrimSpace(filename)
	if filename == "" {
		filename = "boox-notebook.pdf"
	}
	filename = strings.ReplaceAll(filename, "/", "-")
	filename = strings.ReplaceAll(filename, "\\", "-")
	if !strings.HasSuffix(strings.ToLower(filename), ".pdf") {
		filename += ".pdf"
	}
	return filename
}

func propfindBooxDirectory(configRecord *core.Record, requestURL string) ([]webDAVResponse, error) {
	propfindBody := `<?xml version="1.0" encoding="utf-8" ?><d:propfind xmlns:d="DAV:"><d:prop><d:getcontenttype/><d:getcontentlength/><d:getlastmodified/><d:creationdate/><d:getetag/><d:resourcetype/></d:prop></d:propfind>`
	req, err := http.NewRequest("PROPFIND", requestURL, bytes.NewBufferString(propfindBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Depth", "1")
	req.Header.Set("Content-Type", "application/xml")
	applyBooxAuth(req, configRecord)

	resp, err := booxHTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusMultiStatus && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, fmt.Errorf("WebDAV listing failed for %s with status %d: %s", requestURL, resp.StatusCode, strings.TrimSpace(string(body)))
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var multistatus webDAVMultistatus
	if err := xml.Unmarshal(data, &multistatus); err != nil {
		return nil, fmt.Errorf("failed to parse WebDAV response: %w", err)
	}

	return multistatus.Responses, nil
}

func joinURLPath(baseRawURL string, remotePath string) (string, error) {
	baseURL, err := url.Parse(strings.TrimSpace(baseRawURL))
	if err != nil {
		return "", err
	}
	if baseURL.Scheme == "" || baseURL.Host == "" {
		return "", fmt.Errorf("server URL must be absolute")
	}
	if !strings.HasSuffix(baseURL.Path, "/") {
		baseURL.Path += "/"
	}
	joined := baseURL.ResolveReference(&url.URL{Path: strings.TrimPrefix(remotePath, "/")})
	return joined.String(), nil
}

func resolveBooxRemoteURL(baseURL *url.URL, href string) (string, error) {
	parsedHref, err := url.Parse(strings.TrimSpace(href))
	if err != nil {
		return "", err
	}
	if parsedHref.IsAbs() {
		return parsedHref.String(), nil
	}
	resolved := baseURL.ResolveReference(parsedHref)
	return resolved.String(), nil
}

func normalizeRemoteFilePath(rootURL *url.URL, remoteRawURL string) string {
	parsedRemoteURL, err := url.Parse(strings.TrimSpace(remoteRawURL))
	if err != nil {
		return ""
	}
	decodedRootPath, err := url.PathUnescape(rootURL.Path)
	if err != nil {
		decodedRootPath = rootURL.Path
	}
	decodedRemotePath, err := url.PathUnescape(parsedRemoteURL.Path)
	if err != nil {
		decodedRemotePath = parsedRemoteURL.Path
	}
	decodedRootPath = path.Clean(decodedRootPath)
	decodedRemotePath = path.Clean(decodedRemotePath)

	if decodedRemotePath == decodedRootPath {
		return ""
	}

	prefix := decodedRootPath
	if prefix != "/" {
		prefix += "/"
		if !strings.HasPrefix(decodedRemotePath, prefix) {
			return ""
		}
	}

	relativePath := strings.TrimPrefix(decodedRemotePath, prefix)
	relativePath = strings.TrimPrefix(relativePath, "/")
	if relativePath == "" {
		return ""
	}
	return relativePath
}

func ensureTrailingSlash(rawURL string) string {
	if rawURL == "" || strings.HasSuffix(rawURL, "/") {
		return rawURL
	}
	return rawURL + "/"
}

func stripURLFragment(rawURL string) string {
	parsedURL, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}
	parsedURL.Fragment = ""
	return parsedURL.String()
}

func sameRemoteResource(left string, right string) bool {
	return ensureTrailingSlash(stripURLFragment(left)) == ensureTrailingSlash(stripURLFragment(right))
}

func firstOKProp(propStats []webDAVPropStat) *webDAVProp {
	for _, propStat := range propStats {
		if strings.Contains(propStat.Status, "200") {
			return &propStat.Prop
		}
	}
	return nil
}

func booxNotebookNeedsFileRefresh(record *core.Record, notebook booxRemoteNotebook) bool {
	if len(record.GetStringSlice("files")) == 0 {
		return true
	}
	if strings.TrimSpace(record.GetString("previewThumbnail")) == "" {
		return true
	}
	if record.GetInt("sourcePageCount") <= 0 {
		return true
	}
	if record.GetString("sourcePath") != notebook.RemotePath {
		return true
	}
	if record.GetString("sourceModifiedAt") != notebook.ModifiedAt {
		return true
	}
	if record.GetString("sourceContentLength") != formatBooxContentLength(notebook.Size) {
		return true
	}
	storedETag := strings.TrimSpace(record.GetString("sourceETag"))
	remoteETag := strings.TrimSpace(notebook.ETag)
	if storedETag != remoteETag && (storedETag != "" || remoteETag != "") {
		return true
	}
	return false
}

func normalizeBooxRemoteTimestamp(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	for _, layout := range []string{time.RFC3339, time.RFC3339Nano, time.RFC1123, time.RFC1123Z, time.RFC850, time.ANSIC} {
		if parsed, err := time.Parse(layout, raw); err == nil {
			return parsed.UTC().Format(time.RFC3339)
		}
	}
	return raw
}

func formatBooxContentLength(size int64) string {
	if size <= 0 {
		return ""
	}
	return strconv.FormatInt(size, 10)
}

func setBooxTextFieldIfChanged(record *core.Record, fieldName string, next string) bool {
	next = strings.TrimSpace(next)
	if strings.TrimSpace(record.GetString(fieldName)) == next {
		return false
	}
	record.Set(fieldName, next)
	return true
}

func setBooxBoolFieldIfChanged(record *core.Record, fieldName string, next bool) bool {
	if record.GetBool(fieldName) == next {
		return false
	}
	record.Set(fieldName, next)
	return true
}

func setBooxNumberFieldIfChanged(record *core.Record, fieldName string, next int) bool {
	if record.GetInt(fieldName) == next {
		return false
	}
	record.Set(fieldName, next)
	return true
}

func setBooxMirroredPageTimestamps(app *pocketbase.PocketBase, recordID string, createdAt string, updatedAt string) error {
	createdAt = strings.TrimSpace(createdAt)
	updatedAt = strings.TrimSpace(updatedAt)
	if createdAt == "" && updatedAt == "" {
		return nil
	}
	if createdAt == "" {
		createdAt = updatedAt
	}
	if updatedAt == "" {
		updatedAt = createdAt
	}
	_, err := app.DB().NewQuery(`
		UPDATE pages
		SET created = {:created}, updated = {:updated}
		WHERE id = {:id}
	`).Bind(map[string]any{
		"created": createdAt,
		"updated": updatedAt,
		"id":      recordID,
	}).Execute()
	return err
}

func requireWorkspaceMembership(app *pocketbase.PocketBase, workspaceId string, userId string) (*core.Record, error) {
	record, err := app.FindFirstRecordByFilter(
		"workspace_members",
		"workspace = {:wid} && user = {:uid}",
		map[string]any{"wid": workspaceId, "uid": userId},
	)
	if err != nil {
		return nil, apis.NewForbiddenError("You are not a member of this workspace", nil)
	}
	return record, nil
}

func requireWorkspaceAdmin(app *pocketbase.PocketBase, workspaceId string, userId string) error {
	record, err := requireWorkspaceMembership(app, workspaceId, userId)
	if err != nil {
		return err
	}
	role := record.GetString("role")
	if role != "owner" && role != "admin" {
		return apis.NewForbiddenError("You must be a workspace admin to manage BOOX integration", nil)
	}
	return nil
}

func findBooxIntegrationRecord(app *pocketbase.PocketBase, workspaceId string) (*core.Record, error) {
	record, err := app.FindFirstRecordByFilter(
		"boox_integrations",
		"workspace = {:wid}",
		map[string]any{"wid": workspaceId},
	)
	if err != nil {
		return nil, err
	}
	return record, nil
}

func upsertBooxIntegrationRecord(app *pocketbase.PocketBase, workspaceId string, body booxIntegrationPayload) (*core.Record, error) {
	collection, err := app.FindCollectionByNameOrId("boox_integrations")
	if err != nil {
		return nil, err
	}

	record, err := findBooxIntegrationRecord(app, workspaceId)
	if err != nil || record == nil {
		record = core.NewRecord(collection)
		record.Set("workspace", workspaceId)
	}

	record.Set("enabled", body.Enabled)
	record.Set("serverUrl", strings.TrimSpace(body.ServerURL))
	record.Set("username", strings.TrimSpace(body.Username))
	record.Set("rootPath", normalizeBooxRootPath(body.RootPath))
	if body.ClearPassword {
		record.Set("password", "")
	} else if strings.TrimSpace(body.Password) != "" {
		record.Set("password", body.Password)
	}

	if err := app.Save(record); err != nil {
		return nil, err
	}

	return record, nil
}

func buildBooxIntegrationResponse(app *pocketbase.PocketBase, workspaceId string, record *core.Record) booxIntegrationResponse {
	notebookCount := 0
	if records, err := app.FindRecordsByFilter(
		"pages",
		"workspace = {:wid} && sourceOrigin = 'boox' && sourceItemType = 'notebook'",
		"",
		0,
		0,
		map[string]any{"wid": workspaceId},
	); err == nil {
		notebookCount = len(records)
	}

	if record == nil {
		return booxIntegrationResponse{
			Enabled:       false,
			RootPath:      "/",
			HasPassword:   false,
			NotebookCount: notebookCount,
			Configured:    false,
		}
	}

	return booxIntegrationResponse{
		Enabled:        record.GetBool("enabled"),
		ServerURL:      record.GetString("serverUrl"),
		Username:       record.GetString("username"),
		RootPath:       normalizeBooxRootPath(record.GetString("rootPath")),
		HasPassword:    record.GetString("password") != "",
		LastSyncAt:     record.GetString("lastSyncAt"),
		LastSyncStatus: record.GetString("lastSyncStatus"),
		LastSyncError:  record.GetString("lastSyncError"),
		NotebookCount:  notebookCount,
		Configured:     record.GetString("serverUrl") != "",
	}
}

// ---------------------------------------------------------------------------
// PDF thumbnail generation
// ---------------------------------------------------------------------------

// generateAndAttachThumbnail extracts page count, generates a thumbnail from
// the last page of the PDF, and sets both on the record.  Non-fatal: if
// thumbnail generation fails the record is updated with just the page count.
func generateAndAttachThumbnail(record *core.Record, pdfData []byte) {
	thumbData, pageCount, err := generatePDFLastPageThumbnail(pdfData)
	if pageCount > 0 {
		record.Set("sourcePageCount", pageCount)
	}

	if err != nil {
		log.Printf("[BOOX] thumbnail generation warning: %v", err)
		return
	}
	if thumbData == nil {
		return
	}

	thumbFile, err := filesystem.NewFileFromBytes(thumbData, "preview_thumb.png")
	if err != nil {
		log.Printf("[BOOX] failed to wrap thumbnail bytes: %v", err)
		return
	}
	record.Set("previewThumbnail", thumbFile)
}
