import { spawn } from "child_process";
import ip from "ip";

export const ipWhitelist = async (req, res) => {
  const { address, login, accessToken } = req.body;
  if (!address || !login || !accessToken) {
    return res.status(400).json({ error: "Missing required fields: IP address, login, and accessToken are required" });
  }
  const addr = String(address).trim();
  if (!ip.isV4Format(addr) && !ip.isV6Format(addr)) {
    return res.status(400).json({ error: "Invalid IP address format" });
  }

  // TODO: validate accessToken for login here

  // Use full paths to match sudoers entry
  const sudoPath = "/usr/bin/sudo";        // verify with `which sudo`
  const iptPath  = "/usr/sbin/iptables";   // verify with `which iptables`

  const args = [
    iptPath,
    "-I", "INPUT", "1",
    "-p", "tcp",
    "-m", "tcp",
    "-s", addr,
    "--dport", "25565",
    "-j", "ACCEPT",
  ];

  const child = spawn(sudoPath, args, { stdio: ["ignore", "pipe", "pipe"] });

  let stderr = "";
  child.stderr.on("data", (d) => { stderr += d.toString(); });

  child.on("close", (code) => {
    if (code !== 0) {
      console.error(`iptables error: ${stderr}`);
      return res.status(500).json({ error: "Failed to update iptables" });
    }
    return res.json({ success: true, message: `IP ${addr} whitelisted for port 25565` });
  });
};

