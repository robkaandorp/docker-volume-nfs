import util from 'util';
import child_process from "child_process";
const execFile = util.promisify(child_process.execFile);
import fs from "fs";

export default class Nfs {
    constructor(readonly options: { server: string, path: string, mountOpts: string }) { }

    async list(): Promise<{ name: string, mountPoint: string }[]> {
        try {
            const dir = fs.opendirSync(this.getMountPoint(""));
            let items: { name: string, mountPoint: string}[] = [];

            let dirent: fs.Dirent;
            while (dirent = dir.readSync()) {
                if (dirent.isDirectory() && dirent.name !== "." && dirent.name !== "..") {
                    items.push({ name: dirent.name, mountPoint: this.getMountPoint(dirent.name) });
                }
            }

            return items;
        }
        catch (error) {
            console.error(error);
            throw new Error(`list directory command failed: ${error.message}`);
        }
    }
    
    async getInfo(name: string): Promise<{ name: string, mountPoint: string, bytes_used: number }> {
        const stat = fs.statSync(this.getMountPoint(name));

        return {
            name: name,
            mountPoint: stat.isDirectory() ? this.getMountPoint(name) : "",
            bytes_used: stat.size
        };
    }

    getMountPoint(name: string): string {
        return `/mnt/volumes/${this.options.server}/${this.options.path}/${name}`;
    }

    async create(name: string): Promise<void> {
        try {
            fs.mkdirSync(this.getMountPoint(name), { recursive: true });
        }
        catch (error) {
            console.error(error);
            throw new Error(`mkdir command failed: ${error.message}`);
        }
    }

    async remove(name: string): Promise<void> {
        try {
            fs.rmdirSync(this.getMountPoint(name), { recursive: true });
        }
        catch (error) {
            console.error(error);
            throw new Error(`rmdir command failed: ${error.message}`);
        }
    }

    async mount(): Promise<void> {
        const mountPoint = this.getMountPoint("");
        const device = `${this.options.server}:${this.options.path}`;

        fs.mkdirSync(mountPoint, { recursive: true });
    
        try {
            let args: string[] = ["-t", "nfs"];
    
            if (this.options.mountOpts) {
                args.push("-o", this.options.mountOpts);
            }
    
            args.push(device, mountPoint);
    
            const { stdout, stderr } = await execFile("mount", args, { timeout: 30000 });
            if (stderr) console.error(stderr);
            if (stdout) console.log(stdout);
        }
        catch (error) {
            console.error(error);
            throw new Error(`mount command failed with code ${error.code}: ${error.message}`);
        }
    }

    async unmount(): Promise<void> {
        const mountPoint = this.getMountPoint("");
        
        try {
            const { stdout, stderr } = await execFile("umount", [mountPoint], { timeout: 30000 });
            if (stderr) console.error(stderr);
            if (stdout) console.log(stdout);
        }
        catch (error) {
            console.error(error);
            throw new Error(`umount command failed with code ${error.code}: ${error.message}`);
        }

        fs.rmdirSync(mountPoint);
    }
}