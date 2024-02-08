import {
  createFromIdls,
  renderJavaScriptVisitor,
  renderRustVisitor
} from "@metaplex-foundation/kinobi";

// Instantiate Kinobi.
const kinobi = createFromIdls(["target/idl/rock_paper_scissors.json"]);

// Update the Kinobi tree using visitors...

// Render JavaScript.
kinobi.accept(renderJavaScriptVisitor("clients/js/generated") as any);
// kinobi.accept(renderRustVisitor("clients/rust/generated") as any);
