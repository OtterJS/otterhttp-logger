import { access, readFile, rm } from "node:fs/promises"
import { App } from "@otterhttp/app"
import { bold, cyan, magenta, red } from "colorette"
import { describe, expect, it, onTestFinished } from "vitest"

import { makeFetch } from "./make-fetch"

import { LogLevel, logger } from "@/index"

async function checkFileExists(file: string) {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
}

describe("Logger tests", () => {
  it("should use the timestamp format specified in the `format` property", async () => {
    const originalConsoleLog = console.log

    console.log = (log: string) => {
      expect(log.split(" ")[0]).toMatch(/[0-9]{2}:[0-9]{2}/)
      console.log = originalConsoleLog
    }

    const app = new App()
    app.use(logger({ timestamp: { format: "mm:ss" } }))

    const server = app.listen()
    onTestFinished(() => void server.close())

    const response = await makeFetch(server)("/")
    expect(response.status).toBe(404)
  })
  it("should enable timestamp if `timestamp` property is true", async () => {
    const originalConsoleLog = console.log

    console.log = (log: string) => {
      expect(log).toMatch(/[0-9]{2}:[0-9]{2}:[0-9]{2}/)
      console.log = originalConsoleLog
    }

    const app = new App()
    app.use(logger({ timestamp: true }))

    const server = app.listen()
    onTestFinished(() => void server.close())

    const response = await makeFetch(server)("/")
    expect(response.status).toBe(404)
  })
  it("should check for levels when supplied", async () => {
    const level = LogLevel.log
    const originalConsoleLog = console.log

    console.log = (log: string) => {
      expect(log).toMatch(`[${level.toUpperCase()}] GET 404 Not Found /`)
      console.log = originalConsoleLog
    }

    const app = new App()
    app.use(
      logger({
        timestamp: false,
        output: { callback: console.log, color: false, level: level },
      }),
    )

    const server = app.listen()
    onTestFinished(() => void server.close())

    const response = await makeFetch(server)("/")
    expect(response.status).toBe(404)
  })

  it("should call a custom output function", async () => {
    const customOutput = (log: string) => {
      expect(log).toMatch("GET 404 Not Found /")
    }

    const app = new App()
    app.use(logger({ output: { callback: customOutput, color: false } }))

    const server = app.listen()
    onTestFinished(() => void server.close())

    const response = await makeFetch(server)("/")
    expect(response.status).toBe(404)
  })
  describe("Log file tests", () => {
    it("should check if log file and directory is created", async () => {
      const filename = "./tests/tiny.log"

      const app = new App()
      app.use(
        logger({
          output: {
            callback: console.log,
            color: false,
            filename: filename,
            level: LogLevel.log,
          },
        }),
      )
      const server = app.listen()
      onTestFinished(() => void server.close())
      onTestFinished(() => rm(filename))

      const response = await makeFetch(server)("/")
      expect(response.status).toBe(404)
      await expect(checkFileExists(filename)).resolves.toBe(true)
    })
    it("should read log file and check if logs are written", async () => {
      const filename = "./logs/test1/tiny.log"
      const level = LogLevel.warn
      const app = new App()
      app.use(
        logger({
          output: {
            callback: console.warn,
            color: false,
            filename: filename,
            level: level,
          },
        }),
      )

      const server = app.listen()
      onTestFinished(() => void server.close())
      onTestFinished(() => rm(filename))

      const response = await makeFetch(server)("/")
      expect(response.status).toBe(404)
      await expect(checkFileExists(filename)).resolves.toBe(true)

      async function readLogFile() {
        const fileBlob = await readFile(filename)
        const fileContents = fileBlob.toString()
        return fileContents.split("\n")
      }
      await expect(readLogFile()).resolves.toMatchObject([
        `[${level.toUpperCase()}] GET 404 Not Found /`,
        expect.any(String),
      ])
    })
  })

  describe("Color logs", () => {
    const createColorTest = (status: number, color: string) => {
      return async () => {
        const customOutput = (log: string) => {
          if (color === "cyan") {
            expect(log.split(" ")[1]).toMatch(cyan(bold(status.toString()).toString()))
          } else if (color === "red") {
            expect(log.split(" ")[1]).toMatch(red(bold(status.toString()).toString()))
          } else if (color === "magenta") {
            expect(log.split(" ")[1]).toMatch(magenta(bold(status.toString()).toString()))
          }
        }

        const app = new App()

        app.use(logger({ output: { callback: customOutput, color: true } }))
        app.get("/", (_, res) => res.status(status).send(""))

        const server = app.listen()
        onTestFinished(() => void server.close())

        const response = await makeFetch(server)("/")
        expect(response.status).toBe(status)
      }
    }

    it("should color 2xx cyan", createColorTest(200, "cyan"))

    it("should color 4xx red", createColorTest(400, "red"))

    it("should color 5xx magenta", createColorTest(500, "magenta"))
  })
  describe("Badge Log", () => {
    it("should display emoji", async () => {
      const app = new App()

      const customOutput = (log: string) => {
        expect(log).toMatch(/✅/)
      }

      app.use(
        logger({
          emoji: true,
          output: { callback: customOutput, color: false },
        }),
      )

      app.get("/", (_, res) => res.status(200).send(""))

      const server = app.listen()
      onTestFinished(() => void server.close())

      const response = await makeFetch(server)("/")
      expect(response.status).toBe(200)
    })
    it("should not output anything if not passing badge config", async () => {
      const app = new App()
      const customOutput = (log: string) => {
        expect(log).toMatch("GET 200 OK /")
      }

      app.use(logger({ output: { callback: customOutput, color: false } }))

      app.get("/", (_, res) => res.status(200).send(""))

      const server = app.listen()
      onTestFinished(() => void server.close())

      const response = await makeFetch(server)("/")
      expect(response.status).toBe(200)
    })
    it("should display both emoji and caption", async () => {
      const app = new App()
      const customOutput = (log: string) => {
        expect(log).toMatch("✅ GET 200 OK /")
      }

      app.use(
        logger({
          emoji: true,
          output: { callback: customOutput, color: false },
        }),
      )

      app.get("/", (_, res) => res.status(200).send(""))

      const server = app.listen()
      onTestFinished(() => void server.close())

      const response = await makeFetch(server)("/")
      expect(response.status).toBe(200)
    })

    const createEmojiTest = (status: number, expected: string) => {
      return async () => {
        const app = new App()
        const customOutput = (log: string) => {
          expect(log.split(" ")[0]).toMatch(expected)
        }

        app.use(
          logger({
            emoji: true,
            output: { callback: customOutput, color: false },
          }),
        )

        app.get("/", (_, res) => res.status(status).send(""))

        const server = app.listen()
        onTestFinished(() => void server.close())

        const response = await makeFetch(server)("/")
        expect(response.status).toBe(status)
      }
    }
    it("should output correct 2XX log", createEmojiTest(200, "✅"))
    it("should output correct 4XX log", createEmojiTest(400, "🚫"))
    it("should output correct 404 log", createEmojiTest(404, "❓"))
    it("should output correct 5XX log", createEmojiTest(500, "💣"))
  })
})
