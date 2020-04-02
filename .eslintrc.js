module.exports = {
  extends: ['airbnb-base', 'airbnb-typescript'],
  plugins: ['prettier', '@typescript-eslint', 'import'],
  rules: {
    'import/prefer-default-export': 'off',
    'no-console': 'off',
    '@typescript-eslint/no-implied-eval': 'off',
    '@typescript-eslint/indent': 'off',
    '@typescript-eslint/no-throw-literal': 'off',
    'no-plusplus': ['error', { allowForLoopAfterthoughts: true }],
    'no-param-reassign': ['error', { props: false }],
  },
};
