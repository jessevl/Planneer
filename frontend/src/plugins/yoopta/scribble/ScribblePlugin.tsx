import { YooptaPlugin } from '@yoopta/editor';

import { ScribbleIcon } from '@/components/common/Icons';

import { ScribbleCommands } from './commands';
import ScribbleRender from './ScribbleRender';
import {
  DEFAULT_SCRIBBLE_PROPS,
  type ScribbleElementMap,
  type ScribbleElementProps,
} from './types';

const ScribblePlugin = new YooptaPlugin<ScribbleElementMap>({
  type: 'Scribble',
  elements: {
    scribble: {
      render: ScribbleRender,
      props: DEFAULT_SCRIBBLE_PROPS as ScribbleElementProps,
    },
  },
  commands: ScribbleCommands,
  options: {
    display: {
      title: 'Scribble',
      description: 'Add a full-page handwriting sheet',
      icon: <ScribbleIcon className="w-6 h-6" />,
    },
    shortcuts: ['scribble', 'handwrite', 'ink', 'page'],
  },
});

export { ScribblePlugin };