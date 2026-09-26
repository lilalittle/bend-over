import {join,resolve} from "node:path";
import config from "../../release.config.json";
import {canonical,sha256} from "./package.ts";

const root=resolve(process.argv[2]??".cache/platform-check");
for(const [id,pkg] of Object.entries(config.packages)) {
  const version=(await Bun.file(`packages/${id}/VERSION`).text()).trim();
  const receipts=[];
  for(const platform of ["ubuntu-24.04","macos-15"]) {
    const dir=join(root,`release-check-${platform}`,".cache/releases",`${pkg.name}-${version}`);
    const receipt=await Bun.file(join(dir,"release.json")).json();
    for(const [name,hash] of Object.entries(receipt.assets)) {
      if(sha256(await Bun.file(join(dir,name)).bytes())!==hash)throw new Error(`${platform}: ${name} differs from its receipt`);
    }
    receipts.push(receipt);
  }
  if(canonical(receipts[0])!==canonical(receipts[1]))throw new Error(`${pkg.name}: Linux and macOS release contents differ`);
  console.log(`${pkg.name}: identical Linux/macOS receipts and archive checksums`);
}
