import SwiftUI

/// Three skippable pages: value prop, how folder access works on iOS,
/// and the privacy promise.
struct OnboardingView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var page = 0

    var body: some View {
        VStack {
            TabView(selection: $page) {
                onboardingPage(
                    icon: "character.cursor.ibeam",
                    title: "Rename hundreds of files in a few taps",
                    text: "Build a chain of rules — prefix, counter, find & replace — and see every new name before anything changes."
                )
                .tag(0)
                onboardingPage(
                    icon: "folder.badge.person.crop",
                    title: "You choose what FileFlow can touch",
                    text: "Pick a folder in Files, or import photos. iOS grants access to just that — nothing else on your device."
                )
                .tag(1)
                onboardingPage(
                    icon: "lock.shield",
                    title: "Everything stays on your phone",
                    text: "No upload, no account, no tracking. Renaming happens entirely on-device."
                )
                .tag(2)
            }
            .tabViewStyle(.page)
            .indexViewStyle(.page(backgroundDisplayMode: .always))

            Button {
                if page < 2 {
                    withAnimation { page += 1 }
                } else {
                    dismiss()
                }
            } label: {
                Text(page < 2 ? "Continue" : "Get Started")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .padding(.horizontal, 24)

            Button("Skip") { dismiss() }
                .font(.footnote)
                .padding(.top, 8)
                .padding(.bottom, 16)
                .opacity(page < 2 ? 1 : 0)
        }
    }

    private func onboardingPage(icon: String, title: String, text: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 56))
                .foregroundStyle(.tint)
            Text(title)
                .font(.title2.bold())
                .multilineTextAlignment(.center)
            Text(text)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 32)
    }
}
