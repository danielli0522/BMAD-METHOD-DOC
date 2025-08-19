module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
    jest: true
  },
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'prettier'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: ['./tsconfig.json']
  },
  plugins: [
    '@typescript-eslint',
    'security',
    'import'
  ],
  rules: {
    // TypeScript规则
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'error',
    
    // 安全规则
    'security/detect-sql-injection': 'error',
    'security/detect-object-injection': 'error',
    'security/detect-non-literal-regexp': 'error',
    'security/detect-unsafe-regex': 'error',
    
    // 导入规则
    'import/order': ['error', {
      'groups': [
        'builtin',
        'external',
        'internal',
        'parent',
        'sibling',
        'index'
      ],
      'alphabetize': {
        'order': 'asc',
        'caseInsensitive': true
      }
    }],
    
    // 通用规则
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-alert': 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': 'error',
    'curly': 'error'
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.test.js'],
      env: {
        jest: true
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off'
      }
    }
  ]
};