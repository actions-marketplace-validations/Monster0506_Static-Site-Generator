const path = "./_pages/";

export async function read(name: string): string {
    const file = Bun.file(path+name);
    const text = await file.text();
    return text + "\n";
}


