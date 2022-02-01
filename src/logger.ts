import { createLogger, transports, format, Logger } from "winston"

function createNewLogger(env: string): Logger {
	return createLogger({
		level: "info",
		format: format.combine(
			format.timestamp({ format: "HH:mm:ss.SSS" }),
			format.printf(
				({ timestamp, level, message }) =>
					`> ${timestamp} - ${level} - ${message}`,
			),
		),
		defaultMeta: {},
		transports: [new transports.Console({})],
	})
}

export default createNewLogger
