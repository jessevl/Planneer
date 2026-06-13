/**
 * @file PageMetaPanel.tsx
 * @description Editable metadata panel for the unified right sidepanel
 * @app PAGES - Rendered by UnifiedSidepanel for the "metadata" tab
 *
 * Surfaces the same property edits available from PageHero / PageActionsMenu
 * in a single dedicated panel: icon + color, title, cover, page mode, parent,
 * children view, tasks view, tags, and toggle preferences. Read-only blocks
 * for system info, mirror source details, and backlinks live alongside.
 *
 * Reuses the same primitives as AddTaskForm so editing pages and tasks feels
 * identical: PropertyRow + PropertyPopover for triggers, IconColorPicker for
 * the icon/color combo, InlineTagInput for tags, CoverPickerModal for the
 * cover flow, MoveToParentPicker for the parent flow.
 */
import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  Calendar,
  CheckSquare,
  ChevronRight,
  Clock,
  Folder,
  Image as ImageIcon,
  Info,
  ListTree,
  Minimize2,
  Sidebar as SidebarIcon,
  Tag as TagIcon,
  Trash2,
  Type,
} from 'lucide-react';

import ItemIcon from '@/components/common/ItemIcon';
import IconColorPicker from '@/components/common/IconColorPicker';
import CoverPickerModal from '@/components/common/CoverPickerModal';
import { MoveToParentPicker } from '@/components/common/MoveToParentPicker';
import PageModeToggle from '@/components/common/PageModeToggle';
import { getPageImageUrl } from '@/api/pagesApi';
import { usePageCoverActions } from '@/hooks/usePageCoverActions';
import { useBacklinks } from '@/hooks/useBacklinks';
import useClickOutside from '@/hooks/useClickOutside';
import {
  InlineTagInput,
  PropertyRow,
  PropertyPopover,
  ToggleTile,
} from '@/components/ui';
import type { Page, PageViewMode } from '@/types/page';
import type { Task } from '@/types/task';

const PROPERTY_POPOVER_WIDTH = 280;

function pageIconType(page: Page): 'note' | 'collection' | 'daily' | 'tasks' {
  if ((page as Page & { isDailyNote?: boolean }).isDailyNote) return 'daily';
  if (page.viewMode === 'collection') return 'collection';
  if (page.viewMode === 'tasks') return 'tasks';
  return 'note';
}

function formatDateTime(value?: string | null): string {
  if (!value) return 'Unknown';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Unknown'
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function formatBytes(rawSize?: string | null): string | null {
  const size = Number(rawSize ?? 0);
  if (!Number.isFinite(size) || size <= 0) return null;
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

interface PageMetaPanelProps {
  currentPage: Page;
  childPages: Page[];
  allTasks: Task[];
  pagesById: Record<string, Page>;
  onUpdatePage: (id: string, updates: Partial<Page>) => void;
  onTaskClick: (taskId: string) => void;
  navigate: ReturnType<typeof useNavigate>;
}

const PageMetaPanel: React.FC<PageMetaPanelProps> = ({
  currentPage,
  childPages,
  allTasks,
  pagesById,
  onUpdatePage,
  onTaskClick,
  navigate,
}) => {
  const backlinks = useBacklinks(currentPage.id);
  const coverActions = usePageCoverActions(currentPage.id);
  const isReadOnly = !!currentPage.isReadOnly;

  // ── Title (local buffer, commit on blur / Enter) ─────────────────────
  const [titleDraft, setTitleDraft] = useState(currentPage.title);
  React.useEffect(() => { setTitleDraft(currentPage.title); }, [currentPage.id, currentPage.title]);
  const commitTitle = () => {
    const next = titleDraft.trim();
    if (next && next !== currentPage.title) {
      onUpdatePage(currentPage.id, { title: next });
    } else {
      setTitleDraft(currentPage.title);
    }
  };

  // ── Popover state ────────────────────────────────────────────────────
  const iconRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);

  const [iconOpen, setIconOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);

  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [parentPickerOpen, setParentPickerOpen] = useState(false);

  useClickOutside([
    { ref: iconRef, onOutside: () => setIconOpen(false) },
    { ref: modeRef, onOutside: () => setModeOpen(false) },
  ]);

  // ── Derived data ─────────────────────────────────────────────────────
  const parentPage = currentPage.parentId ? pagesById[currentPage.parentId] : null;
  const directTaskCount = useMemo(
    () => allTasks.filter((t) => t.parentPageId === currentPage.id).length,
    [allTasks, currentPage.id],
  );

  const tags = currentPage.tags?.split(',').map((t) => t.trim()).filter(Boolean) ?? [];
  const tagSuggestions = useMemo(() => {
    const parentKey = currentPage.parentId || '__root__';
    const tagSet = new Set<string>();
    Object.values(pagesById)
      .filter((page) => (page.parentId || '__root__') === parentKey)
      .forEach((page) => {
        page.tags?.split(',').map((t) => t.trim()).filter(Boolean).forEach((t) => tagSet.add(t));
      });
    return Array.from(tagSet).sort();
  }, [pagesById, currentPage.parentId]);
  const tagColorUniverse = useMemo(
    () => Array.from(new Set([...tagSuggestions, ...tags])).sort(),
    [tagSuggestions, tags],
  );

  const description = currentPage.excerpt?.trim() || 'No description yet.';
  const cover = currentPage.coverGradient || currentPage.coverImage;
  const isGradient = !!currentPage.coverGradient && (currentPage.coverGradient.startsWith('linear') || currentPage.coverGradient.startsWith('radial'));
  const coverImageUrl = useMemo(() => {
    if (!cover) return null;
    if (isGradient) return null;
    if (cover.startsWith('http')) return cover;
    return getPageImageUrl(currentPage.id, cover);
  }, [cover, isGradient, currentPage.id]);
  const coverStyle: React.CSSProperties | undefined = cover
    ? isGradient
      ? { background: cover }
      : { backgroundImage: `url(${coverImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : undefined;
  const coverLabel = currentPage.coverImage
    ? 'Image cover'
    : currentPage.coverGradient
      ? 'Gradient cover'
      : undefined;

  const viewMode = currentPage.viewMode;

  const showChildrenInSidebar = currentPage.showChildrenInSidebar ?? (viewMode === 'note');
  const heroCompact = !!currentPage.heroCompact;

  // ── Mutators ─────────────────────────────────────────────────────────
  const setProp = <K extends keyof Page>(key: K, value: Page[K]) => {
    onUpdatePage(currentPage.id, { [key]: value } as Partial<Page>);
  };

  const handleIconColorChange = (icon: string | null, color: string | null) => {
    onUpdatePage(currentPage.id, { icon, color });
  };

  // ── Render helpers ───────────────────────────────────────────────────
  const renderCard = (children: React.ReactNode) => (
    <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-primary)] p-4">
      {children}
    </div>
  );

  const renderSectionLabel = (label: string) => (
    <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-tertiary)]">
      {label}
    </p>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4 pt-3">
      {/* ── Identity card: icon, title, cover ─────────────────────── */}
      {renderCard(
        <>
          <div className="mb-3 flex items-center gap-3">
            <div ref={iconRef} className="relative flex-shrink-0">
              <ItemIcon
                type={pageIconType(currentPage)}
                icon={currentPage.icon}
                color={currentPage.color}
                size="lg"
                onClick={isReadOnly ? undefined : () => setIconOpen((v) => !v)}
              />
              <PropertyPopover
                anchorRef={iconRef}
                open={iconOpen && !isReadOnly}
                usePortal
                portalWidth={PROPERTY_POPOVER_WIDTH}
              >
                <IconColorPicker
                  icon={currentPage.icon}
                  color={currentPage.color}
                  onChange={handleIconColorChange}
                  onIconSelected={() => setIconOpen(false)}
                />
              </PropertyPopover>
            </div>
            <div className="min-w-0 flex-1">
              <input
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.currentTarget.blur();
                  } else if (e.key === 'Escape') {
                    setTitleDraft(currentPage.title);
                    e.currentTarget.blur();
                  }
                }}
                disabled={isReadOnly}
                placeholder="Untitled"
                className="w-full bg-transparent text-base font-semibold text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)] disabled:cursor-not-allowed disabled:text-[var(--color-text-secondary)]"
              />
              <p className="truncate text-xs text-[var(--color-text-tertiary)]">{currentPage.id}</p>
            </div>
          </div>

          {/* Cover preview / picker */}
          <div className="space-y-2">
            {cover ? (
              <div
                className="relative h-24 w-full overflow-hidden rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-secondary)]"
                style={coverStyle}
              >
                {!isGradient && currentPage.coverImage ? (
                  <img
                    src={coverImageUrl ?? ''}
                    alt={currentPage.title || 'Page cover'}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCoverPickerOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-base)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
              >
                <ImageIcon size={12} />
                {cover ? 'Change cover' : 'Add cover'}
              </button>
              {cover && (
                <button
                  type="button"
                  onClick={() => coverActions.removeCover()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-2 py-1.5 text-xs text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)]"
                >
                  <Trash2 size={12} />
                  Remove
                </button>
              )}
              {coverLabel && (
                <span className="ml-auto text-[11px] text-[var(--color-text-tertiary)]">{coverLabel}</span>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Properties card ──────────────────────────────────────── */}
      {renderCard(
        <div className="space-y-1.5">
          {renderSectionLabel('Properties')}

          {/* Page mode */}
          {!currentPage.isDailyNote && (
            <div ref={modeRef} className="relative">
              <PropertyRow
                label="Page mode"
                icon={<Type className="w-4 h-4" />}
                value={viewMode === 'note' ? 'Note' : viewMode === 'collection' ? 'Collection' : 'Tasks'}
                onClick={() => !isReadOnly && setModeOpen((v) => !v)}
                active={modeOpen}
              />
              <PropertyPopover
                anchorRef={modeRef}
                open={modeOpen && !isReadOnly}
                usePortal
                portalWidth={PROPERTY_POPOVER_WIDTH}
              >
                <div className="p-1.5">
                  <PageModeToggle
                    currentMode={viewMode}
                    onModeChange={(mode: PageViewMode) => {
                      setProp('viewMode', mode);
                      setModeOpen(false);
                    }}
                    childCount={childPages.length}
                    taskCount={directTaskCount}
                    variant="card"
                  />
                </div>
              </PropertyPopover>
            </div>
          )}

          {/* Parent */}
          <div className="relative">
            <PropertyRow
              label="Parent"
              icon={parentPage ? (
                <ItemIcon
                  type={pageIconType(parentPage)}
                  icon={parentPage.icon}
                  color={parentPage.color}
                  size="xs"
                />
              ) : <Folder className="w-4 h-4" />}
              value={parentPage ? (parentPage.title || 'Untitled') : 'Workspace root'}
              onClick={() => setParentPickerOpen(true)}
              active={!!parentPage}
            />
          </div>

          {/* Tags — inline, mirrors the AddTaskForm tag-row pattern */}
          <div ref={tagRef} className="relative">
            <div
              className={
                'w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl border transition-all group ' +
                (tags.length
                  ? 'bg-[var(--color-accent-muted)] text-[var(--color-accent-fg)] border-[var(--color-accent-emphasis)]/30'
                  : 'hover:bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)] border-transparent')
              }
            >
              <div className="flex items-center gap-2.5 flex-shrink-0">
                <TagIcon
                  className={
                    'w-4 h-4 transition-colors ' +
                    (tags.length
                      ? 'text-[var(--color-accent-fg)]'
                      : 'text-[var(--color-text-disabled)] group-hover:text-[var(--color-text-secondary)]')
                  }
                />
                <span className="text-sm font-medium">Tags</span>
              </div>
              <div className="flex-1 flex items-center justify-end ml-2 gap-1.5 min-w-0">
                <InlineTagInput
                  value={currentPage.tags || ''}
                  onChange={(value) => setProp('tags', value)}
                  existingTags={tagColorUniverse}
                  isMulti
                  placeholder="Empty"
                  contextKey={`page-tags-${currentPage.id}`}
                  anchorRef={tagRef}
                  className="!border-0 !bg-transparent !p-0 !shadow-none justify-end"
                />
                <ChevronRight className="w-3.5 h-3.5 opacity-20 group-hover:opacity-40 transition-opacity flex-shrink-0" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Display toggles ──────────────────────────────────────── */}
      {renderCard(
        <div className="space-y-2">
          {renderSectionLabel('Display')}
          <div className="grid grid-cols-2 gap-1.5">
            <ToggleTile
              active={!!showChildrenInSidebar}
              onClick={() => setProp('showChildrenInSidebar', !showChildrenInSidebar)}
              label="Show children"
              icon={<SidebarIcon className="w-3.5 h-3.5" />}
            />
            <ToggleTile
              active={heroCompact}
              onClick={() => setProp('heroCompact', !heroCompact)}
              label="Compact hero"
              icon={<Minimize2 className="w-3.5 h-3.5" />}
            />
          </div>
        </div>
      )}

      {/* ── Description (read-only) ──────────────────────────────── */}
      {renderCard(
        <>
          <div className="mb-2">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Description</p>
            <p className="text-xs text-[var(--color-text-tertiary)]">Auto-generated from the page content preview</p>
          </div>
          <p className="text-sm leading-6 text-[var(--color-text-secondary)]">{description}</p>
        </>
      )}

      {/* ── Info (read-only) ─────────────────────────────────────── */}
      {renderCard(
        <>
          <div className="mb-3 flex items-center gap-2">
            <Info className="w-4 h-4 text-[var(--color-text-tertiary)]" />
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Info</p>
          </div>
          <div className="space-y-2">
            <InfoRow icon={<Type size={12} />} label="Type" value={
              currentPage.sourceOrigin
                ? currentPage.sourceItemType === 'root'
                  ? `${currentPage.sourceOrigin} root collection`
                  : `${currentPage.sourceOrigin} ${currentPage.sourceItemType ?? currentPage.viewMode}`
                : currentPage.viewMode
            } />
            <InfoRow icon={<Calendar size={12} />} label="Created" value={formatDateTime(currentPage.created)} />
            <InfoRow icon={<Clock size={12} />} label="Updated" value={formatDateTime(currentPage.updated)} />
            <InfoRow icon={<ListTree size={12} />} label="Children" value={String(childPages.length)} />
            <InfoRow icon={<CheckSquare size={12} />} label="Tasks" value={String(directTaskCount)} />
          </div>
        </>
      )}

      {/* ── Mirror source (read-only) ────────────────────────────── */}
      {currentPage.sourceOrigin && renderCard(
        <>
          <div className="mb-3">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Mirror source</p>
            <p className="text-xs text-[var(--color-text-tertiary)]">Synced from {currentPage.sourceOrigin}</p>
          </div>
          <div className="space-y-2">
            <InfoRow label="Source path" value={currentPage.sourcePath || 'Unknown'} />
            <InfoRow label="Remote created" value={formatDateTime(currentPage.sourceCreatedAt)} />
            <InfoRow label="Remote updated" value={formatDateTime(currentPage.sourceModifiedAt)} />
            <InfoRow label="Last synced" value={formatDateTime(currentPage.sourceLastSyncedAt)} />
            <InfoRow label="Remote size" value={formatBytes(currentPage.sourceContentLength) || 'Unknown'} />
            <InfoRow label="ETag" value={currentPage.sourceETag || 'Unavailable'} />
          </div>
        </>
      )}

      {/* ── Backlinks ────────────────────────────────────────────── */}
      {renderCard(
        <>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">Backlinks</p>
              <p className="text-xs text-[var(--color-text-tertiary)]">Items that reference this page</p>
            </div>
            <span className="rounded-full bg-[var(--color-surface-tertiary)] px-2 py-1 text-xs text-[var(--color-text-secondary)]">
              {backlinks.length}
            </span>
          </div>

          {backlinks.length ? (
            <div className="space-y-2">
              {backlinks.map((bl) => (
                <button
                  key={`${bl.sourceType}-${bl.sourceId}`}
                  type="button"
                  onClick={() => {
                    if (bl.sourceType === 'page') {
                      navigate({ to: '/pages/$id', params: { id: bl.sourceId } });
                    } else {
                      onTaskClick(bl.sourceId);
                    }
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--color-border-subtle)] px-3 py-2 text-left transition-colors hover:bg-[var(--color-surface-tertiary)]"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {bl.sourceType === 'page' ? (
                      <ItemIcon
                        type={bl.sourceViewMode === 'collection' ? 'collection' : bl.sourceViewMode === 'tasks' ? 'tasks' : 'note'}
                        icon={bl.sourceIcon}
                        color={bl.sourceColor}
                        size="sm"
                      />
                    ) : (
                      <CheckSquare className="h-4 w-4 text-[var(--color-text-tertiary)]" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm text-[var(--color-text-primary)]">{bl.sourceTitle}</p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">{bl.sourceType === 'page' ? 'Page' : 'Task'}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">No backlinks yet.</p>
          )}
        </>
      )}

      {/* Modals */}
      <CoverPickerModal
        isOpen={coverPickerOpen}
        onClose={() => setCoverPickerOpen(false)}
        isUploading={coverActions.isUploading}
        onSelectGradient={async (v) => { await coverActions.selectGradient(v); setCoverPickerOpen(false); }}
        onSelectImage={async (url, attr, dl) => { await coverActions.selectUnsplashImage(url, attr, dl); setCoverPickerOpen(false); }}
        onUploadImage={async (f) => { await coverActions.uploadImage(f); setCoverPickerOpen(false); }}
      />

      <MoveToParentPicker
        isOpen={parentPickerOpen}
        onClose={() => setParentPickerOpen(false)}
        pageId={currentPage.id}
        pageTitle={currentPage.title || 'Untitled'}
      />
    </div>
  );
};

const InfoRow: React.FC<{ icon?: React.ReactNode; label: string; value: React.ReactNode }> = ({ icon, label, value }) => (
  <div className="flex items-start justify-between gap-3 text-sm">
    <span className="flex items-center gap-1.5 text-[var(--color-text-tertiary)]">
      {icon}
      <span>{label}</span>
    </span>
    <span className="max-w-[60%] text-right text-[var(--color-text-primary)] break-words">{value}</span>
  </div>
);

export default PageMetaPanel;
