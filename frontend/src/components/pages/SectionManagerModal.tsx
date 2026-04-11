/**
 * @file SectionManagerModal.tsx
 * @description Global Section Manager modal wrapper - handles its own store access
 * @app TASKS - Section management modal with self-contained state
 * 
 * This wrapper component reads from uiStore to determine if the modal should
 * be shown, and passes the appropriate props to SectionManager.
 */
import React, { useCallback } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { usePagesStore, type PagesState } from '@/stores/pagesStore';
import SectionManager from './SectionManager';

const SectionManagerModal: React.FC = () => {
  const managingSectionsTaskPageId = useUIStore((s) => s.managingSectionsTaskPageId);
  const closeSectionManager = useUIStore((s) => s.closeSectionManager);
  
  // Task collections are now pages with viewMode='tasks' and sections stored in the page
  const pagesById = usePagesStore((s: PagesState) => s.pagesById);
  const updatePage = usePagesStore((s: PagesState) => s.updatePage);
  
  // Section management for task collections
  const addSection = useCallback((pageId: string, name: string, color: string) => {
    const page = pagesById[pageId];
    if (!page) return;
    const sections = page.sections || [];
    const maxOrder = sections.reduce((max, s) => Math.max(max, s.order || 0), -1);
    const newSection = { id: `section-${Date.now()}`, name, color, order: maxOrder + 1 };
    updatePage(pageId, { sections: [...sections, newSection] });
  }, [pagesById, updatePage]);
  
  const editSection = useCallback((pageId: string, sectionId: string, name: string, color: string) => {
    const page = pagesById[pageId];
    if (!page?.sections) return;
    const sections = page.sections.map(s => s.id === sectionId ? { ...s, name, color } : s);
    updatePage(pageId, { sections });
  }, [pagesById, updatePage]);
  
  const deleteSection = useCallback((pageId: string, sectionId: string) => {
    const page = pagesById[pageId];
    if (!page?.sections) return;
    const sections = page.sections.filter(s => s.id !== sectionId);
    updatePage(pageId, { sections });
  }, [pagesById, updatePage]);
  
  const reorderSections = useCallback((pageId: string, sectionIds: string[]) => {
    const page = pagesById[pageId];
    if (!page?.sections) return;
    const sectionMap = new Map(page.sections.map(s => [s.id, s]));
    // Map section IDs to sections and update their order property
    const sections = sectionIds
      .map((id, index) => {
        const section = sectionMap.get(id);
        return section ? { ...section, order: index } : null;
      })
      .filter(Boolean) as typeof page.sections;
    updatePage(pageId, { sections });
  }, [pagesById, updatePage]);

  const handleReorderSections = useCallback((sectionId: string, targetId: string) => {
    if (!managingSectionsTaskPageId) return;
    
    const page = pagesById[managingSectionsTaskPageId];
    if (!page?.sections) return;
    
    const currentOrder = page.sections.map(s => s.id);
    const fromIndex = currentOrder.indexOf(sectionId);
    const toIndex = currentOrder.indexOf(targetId);
    
    if (fromIndex !== -1 && toIndex !== -1) {
      const newOrder = [...currentOrder];
      newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, sectionId);
      reorderSections(managingSectionsTaskPageId, newOrder);
    }
  }, [managingSectionsTaskPageId, pagesById, reorderSections]);

  // Don't render if no page is being managed
  if (!managingSectionsTaskPageId) {
    return null;
  }

  const managedPage = pagesById[managingSectionsTaskPageId];
  const managedSections = managedPage?.sections || [];

  return (
    <SectionManager
      sections={managedSections}
      onAddSection={(name, color) => addSection(managingSectionsTaskPageId, name, color)}
      onEditSection={(sectionId, name, color) => editSection(managingSectionsTaskPageId, sectionId, name, color)}
      onDeleteSection={(sectionId) => deleteSection(managingSectionsTaskPageId, sectionId)}
      onReorderSections={handleReorderSections}
      onClose={closeSectionManager}
    />
  );
};

export default SectionManagerModal;
