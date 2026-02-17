declare module 'sql.js' {
  interface Database {
    prepare(sql: string): Statement;
    run(sql: string, params?: any[]): void;
    exec(sql: string): QueryExecResult[];
    getRowsModified(): number;
    export(): Uint8Array;
    close(): void;
  }

  interface Statement {
    bind(params?: any[]): boolean;
    step(): boolean;
    getColumnNames(): string[];
    get(): any[];
    free(): boolean;
  }

  interface QueryExecResult {
    columns: string[];
    values: any[][];
  }

  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => Database;
  }

  export type { Database };
  export default function initSqlJs(config?: any): Promise<SqlJsStatic>;
}
