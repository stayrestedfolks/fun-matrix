# Publishing The Fun Matrix

You do every step here; Claude never publishes, pushes or logs in. Allow about 20 minutes. The site will live at
`https://<your-github-name>.github.io/fun-matrix/`.

## 1. Check it locally first
In a terminal, inside the `fun-matrix` folder:

```
npm test
```
```
npm run check:data
```
```
npm run check:icons
```
All three should end with **pass**, **OK** or "**… icons load**". Then look at it yourself:

```
npm start
```
1. Open http://localhost:8191/ and click through once.
2. Close the server with **Ctrl+C**.

## 2. Create the GitHub repository
1. Go to **https://github.com/new** (sign in if asked).
2. **Repository name:** `fun-matrix`. If you pick another name, the address changes to match.
3. **Description:** "Pick your WoW Forever character fantasy first. A free fan tool by Stay Rested."
4. Choose **Public**. GitHub Pages is free for public repositories.
5. Leave **"Add a README"**, **.gitignore** and **licence** all off. The folder already has them.
6. Click **Create repository**, and leave the page open: it shows your repository's address.

## 3. Upload the files
Pick one way.

### Option A: with Git (recommended)
In a terminal inside the `fun-matrix` folder, run these one at a time. Replace `YOUR-NAME` with your GitHub username.

```
git init -b main
```
Optional, but recommended if your usual Git identity is a personal account: make this repo's commits show the
channel instead.
1. Sign in to GitHub as the channel account and open **Settings → Emails**.
2. Copy the private address it shows, like `12345+stayrestedfolks@users.noreply.github.com`.
3. Run these two commands. They only affect this folder.
```
git config user.name "Stay Rested"
```
```
git config user.email "PASTE-THE-NOREPLY-ADDRESS"
```
Then add the files:
```
git add .
```
```
git status
```
Check the list before you commit:
- `node_modules/` and `.png` files must **not** be in it; `.gitignore` keeps them out.
- You should see `index.html`, `css/`, `js/`, `data/`, `fonts/`, `tools/`, `tests/` and the `.md` files.

```
git commit -m "The Fun Matrix"
```
```
git remote add origin https://YOUR-NAME@github.com/YOUR-NAME/fun-matrix.git
```
```
git push -u origin main
```
- The first push may open a browser window asking you to sign in to GitHub. That's Git Credential Manager; sign in
  as the account that owns the repository.
- Putting `YOUR-NAME@` in the address makes it ask for that account. Without it, it may reuse another account you're
  signed in with, and the push fails with "Permission denied".

### Option B: in the browser, no Git
1. On the new repository's page, click **"uploading an existing file"**.
2. Drag in everything from the `fun-matrix` folder **except** `node_modules`. Keep the folder structure: drag the
   folders themselves, not their contents.
3. Click **Commit changes**.

Hidden files: Windows may hide `.nojekyll` and `.gitignore`. If they don't upload, add `.nojekyll` by hand:
**Add file → Create new file**, name it `.nojekyll`, leave it empty, commit.

## 4. Turn on GitHub Pages
1. In the repository, open **Settings → Pages** (left sidebar).
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Set **Branch** to **main**, folder **/ (root)**, and click **Save**.
4. Wait 1–2 minutes and refresh. The page shows **"Your site is live at https://YOUR-NAME.github.io/fun-matrix/"**.

## 5. Check the live site
- Click through once, all the way to the result.
- **Copy share link:** paste the link into a private window. It should open the same result.
- **Download PNG:** the file should show your character with icons.
- Try it on your phone.

## 6. The page counter (GoatCounter, optional)
GoatCounter counts page views without cookies. It never sees anyone's ratings, because those stay after the `#`.

1. Go to **https://www.goatcounter.com** → **Sign up**. Pick a **code**, e.g. `stayrested`; your dashboard becomes
   `stayrested.goatcounter.com`. Check that its free plan suits the channel; GoatCounter states its terms on the
   sign-up page.
2. Open `index.html` and find this line:
   ```
   <meta name="fm-goatcounter" content="">
   ```
   Put your code between the quotes:
   ```
   <meta name="fm-goatcounter" content="stayrested">
   ```
3. Save, then publish the change. With Git:
   ```
   git commit -am "Turn on the page counter"
   ```
   ```
   git push
   ```
   In the browser, open `index.html` on GitHub, click the pencil, make the same edit, and commit.
4. Visit your live site once, then check your GoatCounter dashboard. Visits from `localhost` are never counted.

## 7. Share it
- **In the video description:** "Try The Fun Matrix: https://YOUR-NAME.github.io/fun-matrix/".
- **Discord:** pin it in `#welcome` or a resources channel.
- The PNG footer prints the site address automatically, so shared cards lead back to it.

## 8. Updating facts after a patch
1. Ask a Claude session: "Update the Fun Matrix data for patch X".
2. It edits `data/forever.json`, sets the new `asOf` date and runs the checks.
3. You review the changes. With Git, `git diff data/forever.json` shows them.
4. Publish:
   ```
   git commit -am "Facts as of <date>"
   ```
   ```
   git push
   ```
The site updates within a couple of minutes, and old share links keep working.

## If something goes wrong
- **404 at the address:** wait 2 minutes. Then check **Settings → Pages**: the branch must be `main` with `/ (root)`,
  and `index.html` must sit at the top of the repository, not inside a subfolder.
- **The page loads but says "The facts couldn't load":** `data/forever.json` is missing from the upload.
- **Icons show as letters:** Blizzard's icon service is down or blocked on that network. The tool still works.
