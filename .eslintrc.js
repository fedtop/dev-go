module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  overrides: [],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['react', '@typescript-eslint'],
  rules: {
    'react/react-in-jsx-scope': 'off', // 关闭react必须引入的规则
    '@typescript-eslint/no-explicit-any': 'off', // 关闭any类型的规则
    '@typescript-eslint/no-unused-vars': 'off', // 关闭未使用变量的规则
    'no-unsafe-optional-chaining': 'off', // 关闭不可使用可选链的规则
  },
}
