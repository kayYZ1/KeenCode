import { run } from "@/tui/render/index.ts";
import { Box, ScrollArea, Spinner, Text, TextInput } from "@/tui/render/components.tsx";
import { initDevTools } from "@/tui/dev/index.ts";
import { useSignal } from "@/tui/render/hooks/signals.ts";
import { useTextInput, type VimMode } from "@/tui/render/hooks/text-input.ts";

interface Message {
	role: "user" | "agent";
	content: string;
}

function Agent() {
	const input = useSignal("");
	const cursor = useSignal(0);
	const mode = useSignal<VimMode>("INSERT");
	const isLoading = useSignal(false);
	const messages = useSignal<Message[]>([
		{ role: "agent", content: "Hello! I'm your coding assistant. How can I help you today?" },
	]);

	const handleSubmit = (value: string) => {
		if (!value.trim() || isLoading.value) return;

		messages.value = [...messages.value, { role: "user", content: value }];
		input.value = "";
		cursor.value = 0;
		isLoading.value = true;

		setTimeout(() => {
			messages.value = [...messages.value, { role: "agent", content: `You said: "${value}"` }];
			isLoading.value = false;
		}, 1500);
	};

	const { cursorStyle } = useTextInput({
		value: input,
		cursorPosition: cursor,
		mode,
		focused: true,
		onSubmit: handleSubmit,
	});

	const visibleMessages = messages.value;

	return (
		<Box flex flexDirection="column" padding={1} gap={1}>
			<ScrollArea flex flexDirection="column" gap={1} padding={1} scrollbar focused autoScroll>
				{visibleMessages.map((msg) => (
					<Box flexDirection="row" gap={1}>
						<Text color={msg.role === "user" ? "green" : "blue"} bold>
							{msg.role === "user" ? ">" : "•"}
						</Text>
						<Text flex color={msg.role === "user" ? "white" : "gray"}>
							{msg.content}
						</Text>
					</Box>
				))}
				{isLoading.value && (
					<Box flexDirection="row" gap={1} alignItems="center">
						<Spinner color="cyan" />
						<Text color="gray" italic>
							Thinking...
						</Text>
					</Box>
				)}
			</ScrollArea>

			<Box border="single" borderLabel={mode.value} padding={1}>
				<TextInput
					value={input.value}
					cursorPosition={cursor.value}
					cursorStyle={cursorStyle}
					placeholder="Type a message..."
					placeholderColor="gray"
					focused
				/>
			</Box>

			<Box>
				<Text color="gray" italic>
					Enter to send • PageUp/PageDown to scroll • i/Esc to toggle mode • Ctrl+C to exit
				</Text>
			</Box>
		</Box>
	);
}

initDevTools();
run(() => <Agent />);
