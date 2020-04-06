# docker-volume-nfs
Docker volume plugin for NFS.

This plugin uses the centos image with a simple node script as docker volume plugin api endpoint. The node script uses the standard commandline tools to perform the nfs mount, mkdir and rm operations.

The plugin mounts the nfs share on startup and creates folders in this share on `docker volume create` and removes them again on `docker volume rm`. The advantage is that the nfs server needs to export
only one share to the docker hosts and `docker volume create` or volume definitions in compose files require no nfs server administration.

Install with:

```
% docker plugin install robkaandorp/nfs NFS_SERVER="192.168.1.2" NFS_PATH="/exported/path/from/nfs/server" NFS_MOUNT_OPTS="noatime,rw"
```

where NFS_MOUNT_OPTS is optional.

Build with or use the build.sh build script (_do not do this on a production system!_):

```
% docker build . -t robkaandorp/nfs

% id=$(docker create robkaandorp/nfs true)
% mkdir rootfs
% docker export "$id" | sudo tar -x -C rootfs
% docker rm -vf "$id"
% docker rmi robkaandorp/nfs

% docker plugin create robkaandorp/nfs .
% rm -rf rootfs

% docker plugin enable robkaandorp/nfs
```

Example of how to create a volume:

```
% docker volume create -d robkaandorp/nfs test2
```
