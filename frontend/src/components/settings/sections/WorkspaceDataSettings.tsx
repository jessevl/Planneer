/**
 * Workspace Data Settings Section
 * Import / Export for tasks and notes.
 */

import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePagesStore, selectTaskCollections } from '@/stores/pagesStore';
import { Button, Select, toastError, toastSuccess } from '@/components/ui';
import {
  SettingsSectionHeader,
  SettingsCard,
  SettingsActionButton,
  SettingsStatusMessage,
} from '@frameer/components/ui';
import { FileSpreadsheet, Download, Upload } from 'lucide-react';
import {
  exportToCSV,
  exportToMarkdown,
  importTasksFromCSV,
  pickCSVFile,
} from '@/lib/dataExport';
import { pickNotesFile, pickNotesFolder } from '@/lib/dataImport';

const WorkspaceDataSettings: React.FC = () => {
  const taskCollections = usePagesStore(useShallow(selectTaskCollections));
  const [selectedPageId, setSelectedPageId] = useState('');
  const [isImportingCSV, setIsImportingCSV] = useState(false);
  const [csvImportResult, setCsvImportResult] = useState<{ imported: number; errors: string[] } | null>(null);

  const handleImportTasksCSV = async () => {
    if (!selectedPageId) { toastError('Please select a task page first'); return; }
    const file = await pickCSVFile();
    if (!file) return;
    setIsImportingCSV(true);
    setCsvImportResult(null);
    try {
      const result = await importTasksFromCSV(file.content, selectedPageId);
      setCsvImportResult(result);
      if (result.imported > 0) toastSuccess(`Imported ${result.imported} task${result.imported !== 1 ? 's' : ''}`);
      if (result.errors.length > 0) toastError(`${result.errors.length} row(s) had errors`);
    } catch (error) {
      toastError((error as Error).message || 'Failed to import CSV');
    } finally {
      setIsImportingCSV(false);
    }
  };

  const handleImportNotes = async (mode: 'file' | 'folder') => {
    const result = mode === 'file' ? await pickNotesFile() : await pickNotesFolder();
    if (!result || result.entries.length === 0) return;
    const pagesStore = usePagesStore.getState();
    const pathToId: Record<string, string> = {};
    let count = 0;
    for (const entry of result.entries) {
      const parentId = entry.parentPath ? pathToId[entry.parentPath] || null : null;
      try {
        const created = await pagesStore.createPage({ title: entry.title, content: entry.content || null, parentId });
        pathToId[entry.path] = created.id;
        count++;
      } catch { /* skip */ }
    }
    toastSuccess(`Imported ${count} page(s)`);
  };

  return (
    <div className="space-y-4">
      {/* Export */}
      <SettingsSectionHeader title="Export" />
      <SettingsCard className="space-y-3">
        <SettingsActionButton
          onClick={async () => { try { await exportToCSV(); } catch {} }}
          icon={<FileSpreadsheet size={14} />}
          label="Export Tasks (CSV)"
        />
        <SettingsActionButton
          onClick={async () => { try { await exportToMarkdown(); } catch {} }}
          icon={<Download size={14} />}
          label="Export Notes (ZIP)"
        />
      </SettingsCard>

      {/* Import Notes */}
      <SettingsSectionHeader title="Import Notes" />
      <SettingsCard className="space-y-3">
        <p className="text-xs text-[var(--color-text-tertiary)]">
          Import Markdown files as notes. Folder structure is preserved.
        </p>
        <div className="flex gap-2">
          <SettingsActionButton onClick={() => handleImportNotes('file')} icon={<Upload size={14} />} label="File" />
          <SettingsActionButton onClick={() => handleImportNotes('folder')} icon={<Upload size={14} />} label="Folder" />
        </div>
      </SettingsCard>

      {/* Import Tasks */}
      <SettingsSectionHeader title="Import Tasks (CSV)" />
      <SettingsCard className="space-y-3">
        <p className="text-xs text-[var(--color-text-tertiary)]">
          CSV must have a "title" column. Optional: dueDate, priority, completed, section, tags, notes.
        </p>
        <Select
          value={selectedPageId}
          onChange={setSelectedPageId}
          placeholder="Choose a task page..."
          options={taskCollections.map((p) => ({ value: p.id, label: p.title }))}
          className="w-full max-w-xs"
        />
        <SettingsActionButton
          onClick={handleImportTasksCSV}
          disabled={!selectedPageId}
          loading={isImportingCSV}
          icon={<FileSpreadsheet size={14} />}
          label={isImportingCSV ? 'Importing...' : 'Import CSV'}
        />
        {csvImportResult && (
          <div className="space-y-1">
            {csvImportResult.imported > 0 && (
              <SettingsStatusMessage type="success" message={`Imported ${csvImportResult.imported} task${csvImportResult.imported !== 1 ? 's' : ''}`} />
            )}
            {csvImportResult.errors.length > 0 && (
              <SettingsStatusMessage type="error" message={`${csvImportResult.errors.length} row(s) had errors`} />
            )}
          </div>
        )}
      </SettingsCard>
    </div>
  );
};

export default WorkspaceDataSettings;
