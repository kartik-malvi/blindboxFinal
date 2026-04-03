// Allow importing CSS files in TypeScript — handled by rollup-plugin-postcss
declare module '*.css' {
  const content: string;
  export default content;
}
