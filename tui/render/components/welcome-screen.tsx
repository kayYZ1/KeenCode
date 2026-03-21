import { Box, Text } from "../components.tsx";

// Spaces use \u00A0 (non-breaking space) so wrapText doesn't collapse them
const LOGO_LINES = [
	"██╗  ██╗███████╗███████╗███╗   ██╗ ██████╗ ██████╗ ██████╗ ███████╗",
	"██║ ██╔╝██╔════╝██╔════╝████╗  ██║██╔════╝██╔═══██╗██╔══██╗██╔════╝",
	"█████╔╝ █████╗  █████╗  ██╔██╗ ██║██║     ██║   ██║██║  ██║█████╗",
	"██╔═██╗ ██╔══╝  ██╔══╝  ██║╚██╗██║██║     ██║   ██║██║  ██║██╔══╝",
	"██║  ██╗███████╗███████╗██║ ╚████║╚██████╗╚██████╔╝██████╔╝███████╗",
	"╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚═══╝ ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝",
].map((line) => line.replace(/ /g, "\u00A0"));

export interface WelcomeScreenProps {
	version: string;
	subtitle?: string;
}

export function WelcomeScreen({ version, subtitle = "Type a message to get started" }: WelcomeScreenProps) {
	return (
		<Box flex flexDirection="column" justifyContent="center" alignItems="center" gap={1}>
			<Box flexDirection="column">
				{LOGO_LINES.map((line, i) => <Text key={i} color="cyan">{line}</Text>)}
			</Box>
			<Box flexDirection="column" alignItems="center" gap={1}>
				<Text color="gray">v{version} — terminal coding agent</Text>
				<Text color="gray" italic>{subtitle}</Text>
			</Box>
		</Box>
	);
}
