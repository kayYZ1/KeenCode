import { run } from "@/tui/render/index.ts";
import { Box, Text, WelcomeScreen } from "@/tui/render/components.tsx";
import { VERSION } from "@/version.ts";

function App() {
	return (
		<Box flex flexDirection="column" padding={1}>
			<WelcomeScreen version={VERSION} />
			<Text color="gray" italic>Press Ctrl+C to exit</Text>
		</Box>
	);
}

run(() => <App />);
