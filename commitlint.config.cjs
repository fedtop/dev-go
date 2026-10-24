module.exports = {
  // 提交类型取自 .cz-config.cjs（与 pnpm cz 交互式提交保持一致）
  extends: ['cz'],
  rules: {
    'type-empty': [2, 'never'],
    'subject-empty': [2, 'never'],
  },
}
