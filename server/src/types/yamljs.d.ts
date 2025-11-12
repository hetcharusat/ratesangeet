declare module 'yamljs' {
  function load(file: string): any;
  function loadAsync(file: string, cb?: (result: any) => void): Promise<any>;
  function parse(str: string, cb?: (result: any) => void): any;
  function stringify(obj: any, depth?: number, arrayIndent?: number): string;
  export { load, loadAsync, parse, stringify };
}
