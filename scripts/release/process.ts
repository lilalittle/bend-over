import { resolve } from "node:path";
export const ROOT = resolve(import.meta.dir,"../..");
export async function run(args: string[], options: { cwd?:string; env?:Record<string,string|undefined>; quiet?:boolean } = {}) {
  const p = Bun.spawn(args, { cwd:options.cwd ?? ROOT, env:{...process.env,BEND_NO_TELEMETRY:"1",...options.env}, stdout:"pipe", stderr:"pipe" });
  const [out,err,code] = await Promise.all([new Response(p.stdout).text(),new Response(p.stderr).text(),p.exited]);
  if (code) throw new Error(`${args[0]} ${args.slice(1).join(" ")} failed (${code})\n${out}${err}`);
  if (options.quiet === false && err) process.stderr.write(err);
  return out.trim();
}
