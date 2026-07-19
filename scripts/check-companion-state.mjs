import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function loadTs(path) {
  const source = fs.readFileSync(path, 'utf8')
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText
  const module = { exports: {} }
  const wrapper = vm.runInThisContext(
    `(function(require,module,exports){${code}\n})`,
    { filename: path },
  )
  wrapper(() => ({}), module, module.exports)
  return module.exports
}

const {
  COMPANION_TASK_TRANSITIONS,
  assertCompanionTransition,
  canCompanionTransition,
  getPrimaryAction,
  mapTaskStatusToClientOrderStatus,
} = loadTs('companion-miniprogram/utils/task-state.ts')

const servicePath = [
  'OFFERED',
  'ACCEPTED',
  'DEPARTING',
  'ARRIVED',
  'MET_PATIENT',
  'IN_SERVICE',
  'PENDING_SUMMARY',
  'COMPLETED',
]

for (let index = 0; index < servicePath.length - 1; index += 1) {
  const current = servicePath[index]
  const next = servicePath[index + 1]
  assert.equal(
    canCompanionTransition(current, next),
    true,
    `应允许任务从 ${current} 推进到 ${next}`,
  )
  assert.doesNotThrow(() => assertCompanionTransition(current, next))
}

assert.equal(canCompanionTransition('OFFERED', 'REJECTED'), true, '待确认任务应允许拒绝')
assert.equal(canCompanionTransition('OFFERED', 'IN_SERVICE'), false, '不得跳过接单和到院节点')
assert.equal(canCompanionTransition('COMPLETED', 'IN_SERVICE'), false, '已完成任务不得回退')
assert.throws(
  () => assertCompanionTransition('ACCEPTED', 'COMPLETED'),
  /INVALID_TASK_TRANSITION:ACCEPTED->COMPLETED/,
)

for (const terminalStatus of ['COMPLETED', 'REJECTED', 'EXPIRED', 'CANCELLED']) {
  assert.deepEqual(
    COMPANION_TASK_TRANSITIONS[terminalStatus],
    [],
    `${terminalStatus} 必须是终态`,
  )
}

assert.equal(
  mapTaskStatusToClientOrderStatus('OFFERED', 'selected'),
  'PENDING_CONFIRMATION',
)
assert.equal(
  mapTaskStatusToClientOrderStatus('OFFERED', 'platform'),
  'PENDING_ASSIGNMENT',
)
assert.equal(mapTaskStatusToClientOrderStatus('ARRIVED'), 'PENDING_SERVICE')
assert.equal(mapTaskStatusToClientOrderStatus('ACCEPTED', 'market'), 'PENDING_SERVICE')
assert.equal(mapTaskStatusToClientOrderStatus('IN_SERVICE'), 'IN_SERVICE')
assert.equal(mapTaskStatusToClientOrderStatus('COMPLETED'), 'PENDING_REVIEW')
assert.equal(mapTaskStatusToClientOrderStatus('CANCELLED'), 'CANCELLED')

assert.deepEqual(getPrimaryAction('ACCEPTED'), {
  text: '确认出发',
  nextStatus: 'DEPARTING',
})
assert.equal(getPrimaryAction('COMPLETED'), null)

console.log('Validated companion task transitions, terminal states, client status mapping and primary actions.')
