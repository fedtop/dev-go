module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    'airbnb-base',
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
    project: './tsconfig.json',
  },
  plugins: ['react', '@typescript-eslint', 'import'],
  settings: {
    // 处理 Unable to resolve path to module ‘xxx
    // 'import/resolver': {
    //   // 默认使用根目录 tsconfig.json
    //   typescript: {
    //     // 从 <roo/>@types 读取类型定义
    //     alwaysTryTypes: true,
    //     directory: './tsconfig.json',
    //   },
    // },
  },
  rules: {
    'no-console': 'off', // 允许使用 console
    'no-alert': 'off', // 允许使用 alert
    'react/react-in-jsx-scope': 'off', // 关闭react必须引入的规则
    '@typescript-eslint/no-explicit-any': 'off', // 关闭any类型的规则
    '@typescript-eslint/no-unused-vars': 'off', // 关闭未使用变量的规则
    'no-unsafe-optional-chaining': 'off', // 关闭不可使用可选链的规则
    'import/extensions': 'off', // 关闭文件后缀名的规则
    'import/no-unresolved': 'off', // 关闭文件路径的规则
    'no-use-before-define': 'off', // 关闭变量使用前定义的规则
    'import/prefer-default-export': 'off', // 关闭默认导出的规则
    'no-unused-expressions': 'off', // 关闭未使用表达式的规则 (可以使用 && || 等)
    'prefer-destructuring': 'off', // 关闭只能通过解构赋值的规则
    'no-shadow': 'off', // TODO 关闭变量覆盖的规则，开启会导致 enum 声明的类型，抛出错误的提示 (暂时关闭) ❌
    '@typescript-eslint/no-shadow': ['error'], // 开启变量覆盖的规则，上面关闭规则的补丁
  },
}
