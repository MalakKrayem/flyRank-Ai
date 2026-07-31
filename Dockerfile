# The recipe for one frozen copy of this app: a base image, the dependencies, the
# source, and the command to run. Build it once and it behaves the same on any
# machine that can run a container — which is the entire promise of this week.

# ---------- stage 1: install dependencies ----------
# Two stages, for one reason worth the extra four lines. npm needs package.json,
# a lockfile, a registry and a cache to install; the running app needs none of
# those, only the node_modules that came out the other end. So the install happens
# here and only its result is carried over — nothing that was needed to build the
# image ends up inside it.
FROM node:22-alpine AS deps

WORKDIR /app

# The lockfile alone, before the source. Docker caches each line by what went into
# it, so `npm ci` is re-run only when the dependencies actually change — editing a
# route rebuilds in a second instead of reinstalling the world.
COPY package.json package-lock.json ./

# `npm ci` installs exactly the lockfile, no resolving and no drift; --omit=dev
# leaves the test-only packages out of the image.
RUN npm ci --omit=dev

# ---------- stage 2: the image that actually ships ----------
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY server.js ./
COPY openapi.json ./
COPY src ./src

# node:*-alpine already ships a non-root `node` user. Running as root inside a
# container is a habit worth not forming: if anything ever escapes the process, it
# should escape into an account that owns nothing.
USER node

# Documentation, not a rule — it records which port the process listens on. What
# actually publishes it is `ports:` in compose.yaml.
EXPOSE 3000

# No npm in the run command. `npm start` would sit between Docker and Node as an
# extra process, and signals sent to stop the container would go to npm instead of
# to the server. `node` as PID 1 gets the SIGTERM itself and exits immediately.
CMD ["node", "server.js"]
