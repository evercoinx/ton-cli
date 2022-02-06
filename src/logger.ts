import { createLogger, transports, format, Logger } from "winston"

function createNewLogger(env: string): Logger {
	return createLogger({
		level: "info",
		format: format.combine(
			format.colorize(),
			format.errors({ stack: true }),
			format.timestamp({ format: "HH:mm:ss.SSS" }),
			format.printf(({ timestamp, level, message, stack }) => {
				const prefix = `> ${timestamp} - ${level}`
				return stack ? `${prefix} ${stack}` : `${prefix} ${message}`
			}),
		),
		defaultMeta: {},
		transports: [new transports.Console({})],
	})
}

export default createNewLogger
