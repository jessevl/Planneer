---
applyTo: 'frontend/src/stores/**/*.ts'
---

# Zustand Store Patterns

## Store Structure

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface XxxState {
  // Data
  itemsById: Record<string, Item>;
  
  // UI state
  selectedId: string | null;
}

interface XxxActions {
  // Data mutations (from sync engine)
  applyBulkLoad: (items: Item[]) => void;
  applyRemoteChange: (event: SyncEvent) => void;
  
  // Local UI actions
  setSelectedId: (id: string | null) => void;
}

export const useXxxStore = create<XxxState & XxxActions>()(
  persist(
    (set, get) => ({
      // ... implementation
    }),
    {
      name: 'xxx-storage',
      partialize: (state) => ({
        // Only persist what's necessary
      }),
    }
  )
);
```

## Critical Rules

### 1. Event-Driven Updates

Stores RECEIVE data from sync engine; they don't fetch:

```typescript
// ✅ Correct: sync engine calls this
applyBulkLoad: (items) => {
  set({ itemsById: indexById(items) });
},

// ❌ Wrong: fetching inside store
loadItems: async () => {
  const items = await pb.collection('items').getFullList();
  set({ itemsById: indexById(items) });
},
```

### 2. Local Changes Go Through Sync Engine

```typescript
// In component
import { syncEngine } from '@/lib/syncEngine';

const handleUpdate = (task: Task) => {
  syncEngine.recordTaskChange(task, ['completed']);
};

// ❌ Wrong: updating store directly
const handleUpdate = (task: Task) => {
  tasksStore.updateTask(task);
  pb.collection('tasks').update(task.id, task);
};
```

### 3. Access Patterns

```typescript
// ✅ Single property: direct selector
const selectedId = useStore((s) => s.selectedId);

// ✅ Multiple properties: useShallow
import { useShallow } from 'zustand/shallow';

const { viewMode, sortBy } = useStore(
  useShallow((s) => ({ viewMode: s.viewMode, sortBy: s.sortBy }))
);

// ✅ Computed/derived: useMemo in component
const sorted = useMemo(
  () => Object.values(tasksById).sort(compareFn),
  [tasksById]
);
```

### 4. Persist Only Necessary Data

```typescript
partialize: (state) => ({
  // ✅ Persist: UI preferences, local-only state
  viewMode: state.viewMode,
  sortOrder: state.sortOrder,
  
  // ❌ Don't persist: data from server, transient UI
  // tasksById: COMES FROM SERVER
  // isLoading: TRANSIENT
}),
```

## Testing Stores

```typescript
describe('tasksStore', () => {
  beforeEach(() => {
    useTasksStore.setState({ tasksById: {}, selectedIds: new Set() });
  });

  it('applies bulk load correctly', () => {
    const tasks = [{ id: '1', title: 'Task 1' }];
    useTasksStore.getState().applyBulkLoad(tasks);
    
    expect(useTasksStore.getState().tasksById['1']).toEqual(tasks[0]);
  });
});
```
