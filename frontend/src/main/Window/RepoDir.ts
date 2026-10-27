import { app } from "electron";
import { mkdir, access, rm } from "node:fs/promises";
import { join } from "node:path";

export const repoRoot = (): string => join(app.getPath("userData"), "repo");

export const sanitizeRepoName = (name: string): string => {
    const clean = (name ?? "")
        .trim()
        .replace(/\.git$/i, "")
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/^[.-]+|[.-]+$/g, "")
        .slice(0, 64)

    return clean && clean !== "." && clean !== ".." ? clean : "lab"
}

export const repoPathFor = async (repoName: string): Promise<string> => {
    const root = await ensureRepoRoot()
    return join(root, sanitizeRepoName(repoName))
}

export const ensureRepoRoot = async (): Promise<string> => {
    const root = repoRoot()
    await mkdir(root, { recursive: true })
    return root
}

export const removeRepoDir = async (dir: string): Promise<void> => {
    await rm(dir, { recursive: true, force: true })
}

async function createDirectory() {
    const path = repoRoot()
    try {
        await access(path)
        return { isCreated: true, path }
    }
    catch {
        try {
            await mkdir(path, { recursive: true })
            return { isCreated: true, path }
        }
        catch {
            return { isCreated: false, path: app.getPath('userData') }
        }
    }
}

export default createDirectory
