FROM rockylinux:9-minimal AS base
RUN curl -fsSL https://rpm.nodesource.com/setup_lts.x | bash -
RUN microdnf install -y nodejs nfs-utils
RUN microdnf clean all
RUN npm update -g

FROM base AS builder
COPY . /app
WORKDIR /app
RUN npm ci
RUN npx tsc
RUN npm prune --production

FROM base
LABEL maintainer="Rob Kaandorp <rob@di.nl>"
COPY --from=builder /app /app
WORKDIR /app
RUN mkdir -p /run/docker/plugins /mnt/state /mnt/volumes
RUN chmod +x entrypoint.sh
CMD ["/app/entrypoint.sh"]