import { run } from "@/tui/render/index.ts";
import { Box, Text } from "@/tui/render/components.tsx";
import { initDevTools } from "@/tui/dev/index.ts";

function App() {
	return (
		<Box flex flexDirection="column" padding={1} gap={1}>
			<Text bold color="white">
				Text Styling Demo
			</Text>

			{/* Basic Colors */}
			<Box border="single" borderLabel="Basic Colors" padding={1} flexDirection="row" gap={2}>
				<Text color="red">Red</Text>
				<Text color="green">Green</Text>
				<Text color="blue">Blue</Text>
				<Text color="yellow">Yellow</Text>
				<Text color="cyan">Cyan</Text>
				<Text color="magenta">Magenta</Text>
			</Box>

			{/* Bright Colors */}
			<Box border="single" borderLabel="Bright Colors" padding={1} flexDirection="row" gap={2}>
				<Text color="brightRed">BrightRed</Text>
				<Text color="brightGreen">BrightGreen</Text>
				<Text color="brightBlue">BrightBlue</Text>
				<Text color="brightYellow">BrightYellow</Text>
				<Text color="brightCyan">BrightCyan</Text>
				<Text color="brightMagenta">BrightMagenta</Text>
			</Box>

			{/* Hex Colors */}
			<Box border="single" borderLabel="Hex Colors" padding={1} flexDirection="row" gap={2}>
				<Text color="#ff6600">Orange (#ff6600)</Text>
				<Text color="#8b5cf6">Purple (#8b5cf6)</Text>
				<Text color="#06b6d4">Teal (#06b6d4)</Text>
				<Text color="#f43f5e">Rose (#f43f5e)</Text>
			</Box>

			{/* Text Decorations */}
			<Box border="single" borderLabel="Text Decorations" padding={1} flexDirection="row" gap={2}>
				<Text bold>Bold</Text>
				<Text italic>Italic</Text>
				<Text underline>Underline</Text>
				<Text strikethrough>Strikethrough</Text>
			</Box>

			{/* Combined Styles */}
			<Box border="single" borderLabel="Combined Styles" padding={1} flexDirection="row" gap={2}>
				<Text bold italic>Bold+Italic</Text>
				<Text bold color="cyan">Bold+Color</Text>
				<Text underline color="yellow">Underline+Color</Text>
				<Text bold italic underline color="magenta">All Decorations</Text>
				<Text strikethrough color="red">Strike+Color</Text>
			</Box>

			{/* Background Colors */}
			<Box border="single" borderLabel="Background Colors" padding={1} flexDirection="row" gap={2}>
				<Text bgColor="red" color="white">Red BG</Text>
				<Text bgColor="blue" color="white">Blue BG</Text>
				<Text bgColor="green" color="black">Green BG</Text>
				<Text bgColor="yellow" color="black">Yellow BG</Text>
				<Text bgColor="#8b5cf6" color="white">Hex BG</Text>
			</Box>

			{/* Flex on Text */}
			<Box border="single" borderLabel="Flex on Text" padding={1} flexDirection="row" gap={1}>
				<Text color="gray">Label:</Text>
				<Text flex color="cyan">This text takes the remaining space (flex)</Text>
			</Box>

			<Text color="gray" italic>
				Press Ctrl+C to exit
			</Text>
		</Box>
	);
}

initDevTools();
run(() => <App />);
