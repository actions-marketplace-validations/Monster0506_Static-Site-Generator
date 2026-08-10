import { join } from "path";

const defaultDir = "./dist/";

export async function write(fname: string, content: string, dir: string = defaultDir): Promise<void> {
    await Bun.write(join(dir, fname), content);
}
