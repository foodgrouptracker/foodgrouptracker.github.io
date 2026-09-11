# Setting up the Food Group Tracker — step by step

This gets the app onto the internet for free using GitHub. No coding, no command line.
You'll use a free desktop program called **GitHub Desktop** to upload the folder, and GitHub
builds and publishes the app for you.

What you'll end up with:

- The app at an address like `https://YOURNAME.github.io/food-group-tracker/`
- The dietitian's Configure Plan page at `https://YOURNAME.github.io/food-group-tracker/configure/`

Allow about half an hour the first time.

---

## Part 1 — A GitHub account

1. Go to **https://github.com** and click **Sign up**.
2. Use any email, pick a username (this becomes part of your app's address, so pick something you're fine with), and finish the steps.
3. Confirm your email when GitHub asks.

Already have an account? Skip to Part 2.

---

## Part 2 — Install GitHub Desktop

1. Go to **https://desktop.github.com** and download it (Mac or Windows).
2. Open it. When it asks you to sign in, click **Sign in to GitHub.com** and use the account from Part 1. Allow it in your browser when asked.
3. Under "Configure Git," accept the defaults and click **Finish**.

---

## Part 3 — Get the folder ready

1. Find the zip you downloaded, `food-group-tracker.zip`.
   - **Mac:** double-click it. A folder called `food-group-tracker` appears.
   - **Windows:** right-click it → **Extract All…** → **Extract**.
2. Move that folder somewhere permanent, like **Documents**. You'll keep using this folder to install updates later.
3. Open the folder and check what's inside. You should see, directly inside it:
   `package.json`, `index.html`, `README.md`, a `src` folder, a `public` folder.

   If instead you see just one folder named `food-group-tracker` inside another one, open the inner one and use *that* as your folder.

---

## Part 4 — Upload the folder to GitHub

1. In GitHub Desktop, click **File → Add Local Repository…**
2. Click **Choose…**, select your `food-group-tracker` folder, and click **Add Repository**.
3. A message appears: *"This directory does not appear to be a Git repository. Would you like to create a repository here instead?"* Click **create a repository**.
4. A form appears. Fill it like this:
   - **Name:** `food-group-tracker` (keep it exactly like this; it becomes part of the address)
   - **Description:** anything or blank
   - **Initialize this repository with a README:** leave **unchecked**
   - **Git Ignore:** None
   - **License:** None

   Click **Create Repository**.
5. Now click the blue **Publish repository** button near the top.
6. In the box that appears:
   - Leave the name as `food-group-tracker`
   - **Untick "Keep this code private."** This matters: the free version of GitHub only publishes websites from public repositories. There is nothing private in the code, and no client data ever touches it.
   - Click **Publish Repository**.

Wait for the upload to finish (the button changes and the progress bar disappears).

---

## Part 5 — Turn on the website

1. In GitHub Desktop, click **Repository → View on GitHub**. Your browser opens to your repository page.
2. Near the top of that page, click the **Settings** tab (the gear icon, on the right end of the tab row).
3. In the left-hand list, click **Pages**.
4. Under **Build and deployment**, find the **Source** dropdown. Change it from "Deploy from a branch" to **GitHub Actions**. It saves automatically.
5. Now click the **Actions** tab at the top of the page (between "Pull requests" and "Projects").
6. You'll see a run called **Deploy to GitHub Pages**. It probably has a red ✗, because it ran before you turned Pages on. That's expected.
7. Click that run, then click **Re-run all jobs** (top right), then **Re-run jobs**.
8. Wait. The run shows a spinning yellow circle while it works, then a green ✓ when finished. If you don't see it change, refresh the page.
9. When it's green, go back to **Settings → Pages**. At the top it now says **"Your site is live at https://…"** with your address. Click **Visit site** to check it opens.

That's the whole deployment. From now on, every time you upload new files (Part 8), GitHub republishes the app on its own.

---

## Part 6 — Install the app on your phone

1. Text or email yourself the address from Part 5.
2. On your phone, open the link.
   - **iPhone:** open it in **Safari**. The page tells you exactly what to tap: the Share button, then **Add to Home Screen**, then **Add**.
   - **Android:** open it in **Chrome**. Tap **Install app** if the page offers it; otherwise the page shows the menu steps.
3. Open **Food Group Tracker** from your home screen. It asks for your plan link. Leave it for now; Part 7 makes one.

Important: the app only saves when opened from the home screen icon, never from the browser. The page enforces this.

---

## Part 7 — Make your own plan link

1. On a computer, open your address with `configure/` on the end, like
   `https://YOURNAME.github.io/food-group-tracker/configure/`
2. Set the boxes for each food group (yours are 8 / 3 / 3 / 3 / 8 / 6 / 8). Add an "Active day" variant with 4 milk if you want it.
3. Click **Copy link**, then text the link to yourself. Or hold your phone up to the QR code.
4. On your phone:
   - **Android:** tap the link. The app opens with your plan.
   - **iPhone:** the link opens in Safari. Tap **Copy plan link**, open the app from your home screen, and paste it in the box. (If the app has no plan yet, the paste box is right on the first screen.)

You're tracking. When you give this to your dietitian, she uses the same `configure/` address.

---

## Part 8 — Installing an update later

When I send you a new zip:

1. Unzip it.
2. Open your `food-group-tracker` folder (the one from Part 3). Delete everything inside it **except** the hidden `.git` folder if you can see it. (If you can't see a `.git` folder, that's fine; just delete the visible files and folders.)
3. Copy everything from the new unzipped folder into your `food-group-tracker` folder.
4. Open GitHub Desktop. The left side lists the changed files.
5. In the bottom-left box, type a short note like `Update` in the **Summary** field, click **Commit to main**, then click **Push origin** at the top.
6. GitHub rebuilds and republishes automatically. Watch the **Actions** tab for the green ✓ if you want to confirm. Phones pick up the new version the next time the app is opened (sometimes the time after that).

---

## If something goes wrong

**The Actions run is red.**
Click into it and look at the step with the ✗. If it says anything about *Pages* or *not enabled*, you skipped Part 5 step 4; fix that and re-run. Anything else: send me a screenshot of the red step.

**The site address shows "404 — There isn't a GitHub Pages site here."**
Either the run hasn't finished yet (check Actions for a green ✓), or the repository is private (Part 4, step 6). To make it public: repository **Settings → General**, scroll to the bottom, **Change visibility → Make public**. Then re-run the Actions job.

**The app opens but says nothing can be saved / keeps showing install steps.**
You opened it from the browser instead of the home-screen icon. Close the browser tab and tap the icon.

**GitHub Desktop says "This directory appears to be a Git repository" or shows odd files.**
You probably added the wrong folder (one level too high or too low). Remove it (Repository → Remove) and redo Part 4 with the folder that directly contains `package.json`.

**You don't see `.git` in Part 8.**
Normal; it's hidden. Deleting the visible files and copying the new ones in works fine.
