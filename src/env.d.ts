declare namespace NodeJS {
  interface ProcessEnv {
    readonly NODE_ENV: "development" | "production";
  }
}

declare const process: {
  env: NodeJS.ProcessEnv;
};


