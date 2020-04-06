import express from "express";
import bodyParser from "body-parser";
import process from "process";

import Nfs from "./nfs";

function cleanupPath(path: string) {
    if (!path) return path;

    if (path.startsWith("/")) {
        path = path.substring(1);
    }

    if (path.endsWith("/")) {
        path = path.substring(0, path.length - 2);
    }

    return path;
}

const socketAddress = "/run/docker/plugins/nfs.sock";
const server = process.env.NFS_SERVER;
const path = cleanupPath(process.env.NFS_PATH);
const mountOpts = process.env.NFS_MOUNT_OPTS || "";
const nfs = new Nfs({ server, path, mountOpts });

const app = express();
app.use(bodyParser.json({ strict: false, type: req => true }));

// Documentation about docker volume plugins can be found here: https://docs.docker.com/engine/extend/plugins_volume/

app.post("/Plugin.Activate", async (request, response) => {
    console.log("Activating nfs volume driver");

    if (!server) {
        return response.json({ Err: "NFS_SERVER is required" });
    }

    if (!path) {
        return response.json({ Err: "NFS_PATH is required" });
    }

    try {
        await nfs.mount()
    }
    catch (error) {
        return response.json({ Err: error.message });
    }

    response.json({
        "Implements": ["VolumeDriver"]
    });
});

/*
    Instruct the plugin that the user wants to create a volume, given a user specified volume name. 
    The plugin does not need to actually manifest the volume on the filesystem yet (until Mount is 
    called). Opts is a map of driver specific options passed through from the user request.
*/
app.post("/VolumeDriver.Create", async (request, response) => {
    const req = request.body as { Name: string, Opts: {  } };

    console.log(`Creating nfs volume ${req.Name}`);

    try {
        await nfs.create(req.Name);
    }
    catch (error) {
        return response.json({ Err: error.message });
    }

    response.json({
        Err: ""
    });
});

/*
    Delete the specified volume from disk. This request is issued when a user invokes 
    docker rm -v to remove volumes associated with a container.
*/
app.post("/VolumeDriver.Remove", async (request, response) => {
    const req = request.body as { Name: string };

    console.log(`Removing nfs volume ${req.Name}`);

    try {
        await nfs.remove(req.Name);
    }
    catch (error) {
        return response.json({ Err: error.message });
    }

    response.json({
        Err: ""
    });
});

/*
    Docker requires the plugin to provide a volume, given a user specified volume name. 
    Mount is called once per container start. If the same volume_name is requested more 
    than once, the plugin may need to keep track of each new mount request and provision 
    at the first mount request and deprovision at the last corresponding unmount request.
*/
app.post("/VolumeDriver.Mount", async (request, response) => {
    const req = request.body as { Name: string, ID: string };
    const mountPoint = nfs.getMountPoint(req.Name);

    console.log(`Mounting nfs volume ${req.Name}, this is a no_op`);

    response.json({
        MountPoint: mountPoint,
        Err: ""
    });
});

/*
    Request the path to the volume with the given volume_name.
*/
app.post("/VolumeDriver.Path", (request, response) => {
    const req = request.body as { Name: string };
    const mountPoint = nfs.getMountPoint(req.Name);

    console.log(`Request path of nfs mount ${req.Name}`);

    response.json({
        MountPoint: mountPoint,
        Err: ""
    });
});

/*
    Docker is no longer using the named volume. Unmount is called once per container stop. 
    Plugin may deduce that it is safe to deprovision the volume at this point.

    ID is a unique ID for the caller that is requesting the mount.
*/
app.post("/VolumeDriver.Unmount", async (request, response) => {
    const req = request.body as { Name: string, ID: string };

    console.log(`Unmounting nfs volume ${req.Name}, this is a no_op`);

    response.json({
        Err: ""
    });
});

/*
    Get info about volume_name.
*/
app.post("/VolumeDriver.Get", async (request, response) => {
    const req = request.body as { Name: string };
    const mountPoint = nfs.getMountPoint(req.Name);

    console.log(`Getting info about nfs volume ${req.Name}`);

    try {
        const info = await nfs.getInfo(req.Name);

        if (!info) {
            return response.json({ Err: "" });
        }

        response.json({
            Volume: {
                Name: req.Name,
                Mountpoint: info.mountPoint || "",
                Status: {
                    bytes_used: info.bytes_used
                }
            },
            Err: ""
        });
    } catch (error) {
        return response.json({ Err: error.message });
    }
});

/*
    Get the list of volumes registered with the plugin.
*/
app.post("/VolumeDriver.List", async (request, response) => {
    console.log("Getting list of registered nfs volumes");

    try {
        const nfsList = await nfs.list();

        response.json({
            Volumes: nfsList.map(info => {
                return {
                    Name: info.name,
                    Mountpoint: info.mountPoint || ""
                };
            }),
            Err: ""
          });
    }
    catch (error) {
        return response.json({ Err: error.message });
    }
});

app.post("/VolumeDriver.Capabilities", (request, response) => {
    console.log("Getting the list of capabilities");

    response.json({
        Capabilities: {
          Scope: "global"
        }
      });
});


const expressServer = app.listen(socketAddress, err => {
    if (err) {
        return console.error(err);
    }

    console.log(`Plugin nfs listening on socket ${socketAddress}`);
});

expressServer.on("close", () => {
    console.log("Plugin nfs stopping, unmounting share");

    try {
        if (server && path) {
            nfs.unmount();
        }
    }
    catch (error) {
        console.error(`Unmount failed: ${error.message}`);
    }

    console.log("Plugin nfs stopped.")
});

process.on('SIGINT', function() {
    expressServer.close();
});