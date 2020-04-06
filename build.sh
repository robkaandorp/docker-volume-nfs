#!/bin/bash

docker plugin disable robkaandorp/nfs -f
docker plugin rm robkaandorp/nfs -f
rm -rf plugin

git pull
docker build . -t robkaandorp/nfs

id=$(docker create robkaandorp/nfs true)
mkdir -p plugin/rootfs
cp config.json plugin/
docker export "$id" | sudo tar -x -C plugin/rootfs
docker rm -vf "$id"
docker rmi robkaandorp/nfs

docker plugin create robkaandorp/nfs plugin/
docker plugin enable robkaandorp/nfs
docker plugin ls
