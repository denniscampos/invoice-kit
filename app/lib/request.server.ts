/* Reading an untrusted request body without agreeing to hold all of it.

   `request.text()` buffers whatever arrives before anything can object, and the
   `content-length` header that would let us refuse early is optional, so a
   caller can simply omit it. Cloudflare accepts bodies far larger than a Worker
   isolate's memory, and the render endpoint takes them from anyone. */

/* Returns the body as text, or null once it passes `limit` bytes. Bytes, not
   characters: an accented letter is two bytes and an emoji is four, so counting
   characters would let a body through at several times the size it claims. */
export async function readBoundedText(
	request: Request,
	limit: number,
): Promise<string | null> {
	const body = request.body;
	if (!body) return "";

	const reader = body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		size += value.byteLength;
		if (size > limit) {
			/* Cancel rather than break: breaking leaves the rest of the body coming,
			   and draining it would spend the memory this function exists to save. */
			await reader.cancel();
			return null;
		}

		chunks.push(value);
	}

	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}

	/* Decoded once at the end, never per chunk: a multibyte character can be
	   split across two chunks, and decoding each alone would corrupt it. */
	return new TextDecoder().decode(bytes);
}
