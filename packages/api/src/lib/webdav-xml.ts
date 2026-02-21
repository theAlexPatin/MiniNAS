import { XMLParser } from "fast-xml-parser";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
});

// --- XML generation ---

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toRFC1123(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toUTCString();
}

export interface DavResource {
  href: string;
  isCollection: boolean;
  displayName: string;
  contentLength: number;
  contentType: string | null;
  lastModified: string;
  etag: string;
}

function resourceProps(r: DavResource): string {
  const resourceType = r.isCollection
    ? `<D:resourcetype><D:collection/></D:resourcetype>`
    : `<D:resourcetype/>`;

  return `<D:response>
<D:href>${escapeXml(r.href)}</D:href>
<D:propstat>
<D:prop>
${resourceType}
<D:displayname>${escapeXml(r.displayName)}</D:displayname>
<D:getcontentlength>${r.contentLength}</D:getcontentlength>
<D:getcontenttype>${escapeXml(r.contentType || "application/octet-stream")}</D:getcontenttype>
<D:getlastmodified>${toRFC1123(r.lastModified)}</D:getlastmodified>
<D:getetag>"${escapeXml(r.etag)}"</D:getetag>
<D:supportedlock>
<D:lockentry><D:lockscope><D:exclusive/></D:lockscope><D:locktype><D:write/></D:locktype></D:lockentry>
</D:supportedlock>
<D:lockdiscovery/>
</D:prop>
<D:status>HTTP/1.1 200 OK</D:status>
</D:propstat>
</D:response>`;
}

export function multistatus(resources: DavResource[]): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
${resources.map(resourceProps).join("\n")}
</D:multistatus>`;
}

export function lockResponse(
  lockToken: string,
  owner: string,
  timeout: number
): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<D:prop xmlns:D="DAV:">
<D:lockdiscovery>
<D:activelock>
<D:locktype><D:write/></D:locktype>
<D:lockscope><D:exclusive/></D:lockscope>
<D:depth>infinity</D:depth>
<D:owner><D:href>${escapeXml(owner)}</D:href></D:owner>
<D:timeout>Second-${timeout}</D:timeout>
<D:locktoken><D:href>${escapeXml(lockToken)}</D:href></D:locktoken>
<D:lockroot><D:href>/</D:href></D:lockroot>
</D:activelock>
</D:lockdiscovery>
</D:prop>`;
}

export function proppatchResponse(href: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
<D:response>
<D:href>${escapeXml(href)}</D:href>
<D:propstat>
<D:prop/>
<D:status>HTTP/1.1 200 OK</D:status>
</D:propstat>
</D:response>
</D:multistatus>`;
}

// --- XML parsing ---

export interface PropfindRequest {
  allprop: boolean;
  propNames: string[];
}

export function parsePropfindBody(body: string): PropfindRequest {
  if (!body || !body.trim()) {
    return { allprop: true, propNames: [] };
  }

  try {
    const parsed = xmlParser.parse(body);
    const propfind = parsed.propfind || parsed["D:propfind"] || {};

    if (propfind.allprop !== undefined || propfind["D:allprop"] !== undefined) {
      return { allprop: true, propNames: [] };
    }

    // Extract requested property names from <prop> element
    const prop = propfind.prop || propfind["D:prop"] || {};
    return { allprop: false, propNames: Object.keys(prop) };
  } catch {
    return { allprop: true, propNames: [] };
  }
}

export interface LockRequest {
  owner: string;
  scope: string;
  type: string;
}

export function parseLockBody(body: string): LockRequest {
  const defaults = { owner: "", scope: "exclusive", type: "write" };
  if (!body || !body.trim()) return defaults;

  try {
    const parsed = xmlParser.parse(body);
    const lockinfo = parsed.lockinfo || parsed["D:lockinfo"] || {};
    const owner =
      lockinfo.owner?.href ||
      lockinfo.owner?.["D:href"] ||
      lockinfo.owner ||
      "";
    return {
      owner: typeof owner === "string" ? owner : "",
      scope: "exclusive",
      type: "write",
    };
  } catch {
    return defaults;
  }
}
