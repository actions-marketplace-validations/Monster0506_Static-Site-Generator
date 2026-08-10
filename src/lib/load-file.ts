import { join } from "path";

const defaultDir = "./_pages/";

export async function read(name: string, dir: string = defaultDir): Promise<string> {
    const file = Bun.file(join(dir, name));
    const text = await file.text();
    return text + "\n";
}
