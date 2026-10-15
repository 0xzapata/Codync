import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

// Exercise the actual component handlers without a window. Native hit testing remains an app check.
test('thread resizing previews locally, saves once on release, and discards cancelled drags', () => {
  type View = { children?: View | View[]; [key: string]: unknown }
  const slots: unknown[] = []
  const effects: (() => void)[] = []
  let cursor = 0
  const react = {
    useRef<T>(initial: T) {
      const index = cursor++
      slots[index] ??= { current: initial }
      return slots[index]
    },
    useState<T>(initial: T) {
      const index = cursor++
      if (!(index in slots)) slots[index] = initial
      return [slots[index], (value: T) => { slots[index] = value }]
    },
    useEffect(effect: () => void) { effects.push(effect) },
  }
  const jsx = (_type: unknown, props: View) => props
  const dependencies: Record<string, unknown> = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '../../components/Overlay': { usePresence: (open: boolean) => ({ mounted: true, shown: open }) },
  }
  const url = new URL('./ChatSidePanel.tsx', import.meta.url)
  const { outputText } = ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
    fileName: url.pathname,
  })
  const exports = {} as { ChatSidePanel: (input: typeof props) => View }
  runInNewContext(outputText, {
    exports,
    require: (name: string) => {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`)
      return dependencies[name]
    },
  })
  const saves: number[] = []
  const props = {
    open: true, width: 420, children: null,
    resize: { min: 280, max: 879, onChange: (width: number) => { saves.push(width); props.width = width } },
  }
  const findDivider = (node: View): View | undefined => node.role === 'separator' ? node
    : (Array.isArray(node.children) ? node.children : [node.children]).filter((child): child is View => !!child).map(findDivider).find(Boolean)
  const render = () => {
    cursor = 0
    const tree = exports.ChatSidePanel(props)
    for (const effect of effects.splice(0)) effect()
    return { tree, divider: findDivider(tree)! }
  }
  const fire = (name: string, clientX = 700, pointerId = 1, key = '') => {
    const { divider } = render()
    const handler = divider[name] as (event: unknown) => void
    handler({ clientX, pointerId, key, button: 0, preventDefault() {}, currentTarget: { setPointerCapture() {} } })
  }

  fire('onPointerDown')
  fire('onPointerMove', 650)
  fire('onPointerMove', 600)
  assert.equal(render().divider['aria-valuenow'], 520)
  assert.equal((render().tree.style as { width: number }).width, 521)
  assert.deepEqual(saves, [], 'pointer movement must not invoke the preference writer')
  fire('onPointerMove', 400, 2)
  fire('onPointerUp', 400, 2)
  assert.deepEqual(saves, [], 'another pointer cannot finish this drag')
  fire('onPointerUp', 600)
  fire('onLostPointerCapture')
  assert.deepEqual(saves, [520], 'release followed by lost capture saves exactly once')
  fire('onPointerDown')
  fire('onPointerUp')
  assert.deepEqual(saves, [520], 'clicking without resizing does not write the preference')

  for (const cancel of ['onPointerCancel', 'onLostPointerCapture']) {
    fire('onPointerDown')
    fire('onPointerMove', 600)
    fire(cancel)
    assert.equal(render().divider['aria-valuenow'], 520)
    assert.deepEqual(saves, [520])
  }
  fire('onPointerDown')
  fire('onPointerMove', 400)
  props.open = false
  render()
  props.open = true
  assert.equal(render().divider['aria-valuenow'], 520, 'reopening must discard an interrupted preview')
  fire('onKeyDown', 0, 1, 'ArrowLeft')
  fire('onKeyDown', 0, 1, 'Home')
  fire('onKeyDown', 0, 1, 'End')
  assert.deepEqual(saves, [520, 540, 280, 879], 'keyboard resizing still persists immediately')
  fire('onPointerDown')
  fire('onPointerMove', 600)
  props.resize.max = 450
  assert.equal(render().divider['aria-valuenow'], 450, 'a shrinking window clamps the live preview')
  fire('onPointerUp', 600)
  assert.equal(saves.at(-1), 450, 'release uses the current window bounds')

  // A fast drag can be released before its final move is delivered, so the saved width must be
  // measured from the release position rather than from the last previewed one.
  const before = saves.length
  props.width = 420
  props.resize.max = 879
  fire('onPointerDown', 700)
  fire('onPointerMove', 600)
  assert.equal(render().divider['aria-valuenow'], 520, 'the last preview still follows the last move')
  fire('onPointerUp', 400)
  assert.deepEqual(saves.slice(before), [720], 'release saves the width at the release position')
})
