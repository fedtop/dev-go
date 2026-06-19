import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const sourceFiles = ['**/*.{js,jsx,ts,tsx,mjs,cjs}']
const typedSourceFiles = ['**/*.{ts,tsx}']
const javascriptFiles = ['**/*.{js,jsx,mjs,cjs}']
const configFiles = ['*.config.{js,cjs,mjs,ts}', 'eslint.config.mjs', 'wxt.config.ts']

const wxtGlobals = {
  createIframeUi: 'readonly',
  createIntegratedUi: 'readonly',
  createShadowRootUi: 'readonly',
  defineBackground: 'readonly',
  defineContentScript: 'readonly',
  defineUnlistedScript: 'readonly',
}

export default tseslint.config(
  {
    ignores: [
      '.output/**',
      '.turbo/**',
      '.wxt/**',
      '.vscode/**',
      'assets/google/**',
      'build/**',
      'coverage/**',
      'dist/**',
      'node_modules/**',
      'out/**',
      'package-lock.json',
      'pnpm-lock.yaml',
      'web-ext.config.ts',
      'yarn.lock',
    ],
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'warn',
    },
  },
  {
    files: sourceFiles,
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        ...wxtGlobals,
      },
      sourceType: 'module',
    },
  },
  {
    files: configFiles,
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.nodeBuiltin,
        ...globals.webextensions,
        ...wxtGlobals,
      },
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: 'commonjs',
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: typedSourceFiles,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: javascriptFiles,
    extends: [tseslint.configs.disableTypeChecked],
  },
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  {
    files: ['**/*.{jsx,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'error',
    },
  },
  {
    files: sourceFiles,
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-shadow': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
          varsIgnorePattern: '^_',
        },
      ],
      curly: ['error', 'multi-line'],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-alert': 'off',
      'no-console': 'off',
      'no-param-reassign': 'off',
      'no-shadow': 'off',
      'no-use-before-define': 'off',
      'no-unused-vars': 'off',
      'no-var': 'error',
      'object-shorthand': ['error', 'always', { avoidQuotes: true }],
      'prefer-const': 'error',
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
    },
  },
  {
    files: typedSourceFiles,
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          fixStyle: 'inline-type-imports',
          prefer: 'type-imports',
        },
      ],
      '@typescript-eslint/no-misused-promises': [
        'warn',
        {
          checksVoidReturn: {
            attributes: false,
          },
        },
      ],
    },
  },
  prettier,
)
