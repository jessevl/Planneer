//go:build !cgo || nocgo

package main

import (
	"fmt"
	"os"
	"os/exec"
	"path"
	"regexp"
	"strconv"
	"strings"
)

// pdfPageCountRegexp matches /Type /Pages ... /Count N in linearised PDFs.
var pdfPageCountRegexp = regexp.MustCompile(`/Type\s*/Pages\b[^>]*/Count\s+(\d+)`)
var pdfInfoPageCountRegexp = regexp.MustCompile(`(?mi)^Pages:\s+(\d+)\s*$`)

// countPDFPages returns the number of pages by scanning the raw PDF bytes for
// the root Pages dictionary. Returns 0 when the count cannot be determined.
func countPDFPages(data []byte) int {
	matches := pdfPageCountRegexp.FindAllSubmatch(data, -1)
	maxCount := 0
	for _, m := range matches {
		if n, err := strconv.Atoi(string(m[1])); err == nil && n > maxCount {
			maxCount = n
		}
	}
	return maxCount
}

func parsePDFInfoPageCount(output []byte) int {
	matches := pdfInfoPageCountRegexp.FindSubmatch(output)
	if len(matches) < 2 {
		return 0
	}
	count, err := strconv.Atoi(strings.TrimSpace(string(matches[1])))
	if err != nil || count <= 0 {
		return 0
	}
	return count
}

func countPDFPagesWithTools(pdfPath string) int {
	if pdfinfoPath, lookErr := exec.LookPath("pdfinfo"); lookErr == nil {
		cmd := exec.Command(pdfinfoPath, pdfPath)
		if output, err := cmd.CombinedOutput(); err == nil {
			if count := parsePDFInfoPageCount(output); count > 0 {
				return count
			}
		}
	}

	if mutoolPath, lookErr := exec.LookPath("mutool"); lookErr == nil {
		cmd := exec.Command(mutoolPath, "info", pdfPath)
		if output, err := cmd.CombinedOutput(); err == nil {
			if count := parsePDFInfoPageCount(output); count > 0 {
				return count
			}
		}
	}

	return 0
}

// generatePDFLastPageThumbnail falls back to external renderers in no-CGO
// builds so local/dev binaries do not crash when CGO is disabled.
func generatePDFLastPageThumbnail(pdfData []byte) ([]byte, int, error) {
	tmpFile, err := os.CreateTemp("", "boox-thumb-*.pdf")
	if err != nil {
		return nil, 0, err
	}
	tmpPath := tmpFile.Name()
	defer os.Remove(tmpPath)

	if _, err := tmpFile.Write(pdfData); err != nil {
		tmpFile.Close()
		return nil, 0, err
	}
	tmpFile.Close()

	pageCount := countPDFPages(pdfData)
	if pageCount <= 0 {
		pageCount = countPDFPagesWithTools(tmpPath)
	}
	if pageCount <= 0 {
		return nil, 0, fmt.Errorf("failed to determine PDF page count in no-CGO build")
	}

	lastPage := strconv.Itoa(pageCount)

	if pdftoppmPath, lookErr := exec.LookPath("pdftoppm"); lookErr == nil {
		outPrefix := tmpPath + "-out"
		defer os.Remove(outPrefix + ".png")

		cmd := exec.Command(pdftoppmPath,
			"-png",
			"-f", lastPage,
			"-l", lastPage,
			"-singlefile",
			"-scale-to", "600",
			tmpPath,
			outPrefix,
		)
		if err := cmd.Run(); err == nil {
			if data, readErr := os.ReadFile(outPrefix + ".png"); readErr == nil && len(data) > 0 {
				return data, pageCount, nil
			}
		}
	}

	if mutoolPath, lookErr := exec.LookPath("mutool"); lookErr == nil {
		outPath := tmpPath + "-out.png"
		defer os.Remove(outPath)

		cmd := exec.Command(mutoolPath,
			"draw",
			"-o", outPath,
			"-F", "png",
			"-w", "600",
			tmpPath,
			lastPage,
		)
		if err := cmd.Run(); err == nil {
			if data, readErr := os.ReadFile(outPath); readErr == nil && len(data) > 0 {
				return data, pageCount, nil
			}
		}
	}

	if qlmanagePath, lookErr := exec.LookPath("qlmanage"); lookErr == nil {
		outDir, err := os.MkdirTemp("", "boox-thumb-ql-*")
		if err == nil {
			defer os.RemoveAll(outDir)

			cmd := exec.Command(qlmanagePath,
				"-t",
				"-s", "1200",
				"-o", outDir,
				tmpPath,
			)
			if err := cmd.Run(); err == nil {
				candidates := []string{
					path.Join(outDir, path.Base(tmpPath)+".png"),
					path.Join(outDir, path.Base(tmpPath)+".pdf.png"),
				}
				for _, candidate := range candidates {
					if data, readErr := os.ReadFile(candidate); readErr == nil && len(data) > 0 {
						return data, pageCount, nil
					}
				}
			}
		}
	}

	return nil, pageCount, fmt.Errorf("no PDF thumbnail renderer available in no-CGO build; install pdftoppm or mutool")
}
