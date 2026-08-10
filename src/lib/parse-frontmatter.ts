export function parseTOML(content: string, delim: string = "+++\n") {
    let start: number = content.indexOf(delim)
    if (start < 0) return {}
    let next: number = content.indexOf(delim, start+1)
    if (next < 0) return {}
    return Bun.TOML.parse(content.slice(start+delim.length, next))

}

export function stripFrontmatter(content: string, delim: string = "+++\n") {
    let start: number = content.indexOf(delim)
    if (start < 0) return content
    let next: number = content.indexOf(delim, start+1)
    if (next < 0) return content
    return content.slice(next+delim.length)
}
