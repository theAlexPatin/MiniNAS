import { describe, it, expect } from "vitest";
import {
  multistatus,
  lockResponse,
  proppatchResponse,
  parsePropfindBody,
  parseLockBody,
  type DavResource,
} from "../../src/lib/webdav-xml.js";

describe("multistatus", () => {
  it("generates valid XML for a collection", () => {
    const resources: DavResource[] = [
      {
        href: "/dav/vol1/",
        isCollection: true,
        displayName: "Volume 1",
        contentLength: 0,
        contentType: null,
        lastModified: "2024-01-01T00:00:00Z",
        etag: "abc123",
      },
    ];

    const xml = multistatus(resources);
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain("<D:multistatus");
    expect(xml).toContain("<D:collection/>");
    expect(xml).toContain("<D:displayname>Volume 1</D:displayname>");
    expect(xml).toContain("<D:href>/dav/vol1/</D:href>");
  });

  it("generates valid XML for a file", () => {
    const resources: DavResource[] = [
      {
        href: "/dav/vol1/readme.txt",
        isCollection: false,
        displayName: "readme.txt",
        contentLength: 1024,
        contentType: "text/plain",
        lastModified: "2024-06-15T12:00:00Z",
        etag: "def456",
      },
    ];

    const xml = multistatus(resources);
    expect(xml).toContain("<D:resourcetype/>");
    expect(xml).toContain("<D:getcontentlength>1024</D:getcontentlength>");
    expect(xml).toContain(
      "<D:getcontenttype>text/plain</D:getcontenttype>"
    );
  });

  it("escapes special XML characters", () => {
    const resources: DavResource[] = [
      {
        href: "/dav/vol1/file&name.txt",
        isCollection: false,
        displayName: 'file&name<"test">',
        contentLength: 0,
        contentType: null,
        lastModified: "2024-01-01T00:00:00Z",
        etag: "xyz",
      },
    ];

    const xml = multistatus(resources);
    expect(xml).toContain("&amp;");
    expect(xml).toContain("&lt;");
    expect(xml).toContain("&gt;");
    expect(xml).toContain("&quot;");
    // Should NOT contain unescaped special chars in element content
    expect(xml).not.toContain("<D:displayname>file&name");
  });
});

describe("lockResponse", () => {
  it("generates lock XML", () => {
    const xml = lockResponse("opaquelocktoken:123", "user@example.com", 3600);
    expect(xml).toContain("<D:locktype><D:write/></D:locktype>");
    expect(xml).toContain("<D:lockscope><D:exclusive/></D:lockscope>");
    expect(xml).toContain("<D:timeout>Second-3600</D:timeout>");
    expect(xml).toContain("opaquelocktoken:123");
  });
});

describe("proppatchResponse", () => {
  it("generates 200 OK response", () => {
    const xml = proppatchResponse("/dav/vol1/file.txt");
    expect(xml).toContain("<D:href>/dav/vol1/file.txt</D:href>");
    expect(xml).toContain("HTTP/1.1 200 OK");
  });
});

describe("parsePropfindBody", () => {
  it("returns allprop for empty body", () => {
    const result = parsePropfindBody("");
    expect(result.allprop).toBe(true);
    expect(result.propNames).toEqual([]);
  });

  it("returns allprop for whitespace", () => {
    const result = parsePropfindBody("  \n  ");
    expect(result.allprop).toBe(true);
  });

  it("parses allprop request", () => {
    const body = `<?xml version="1.0"?>
      <D:propfind xmlns:D="DAV:">
        <D:allprop/>
      </D:propfind>`;
    const result = parsePropfindBody(body);
    expect(result.allprop).toBe(true);
  });

  it("parses specific prop request", () => {
    const body = `<?xml version="1.0"?>
      <propfind xmlns="DAV:">
        <prop>
          <displayname/>
          <getcontentlength/>
        </prop>
      </propfind>`;
    const result = parsePropfindBody(body);
    expect(result.allprop).toBe(false);
    expect(result.propNames).toContain("displayname");
    expect(result.propNames).toContain("getcontentlength");
  });

  it("returns allprop for body without propfind element", () => {
    const result = parsePropfindBody("<root><something/></root>");
    expect(result.allprop).toBe(false);
    expect(result.propNames).toEqual([]);
  });
});

describe("parseLockBody", () => {
  it("returns defaults for empty body", () => {
    const result = parseLockBody("");
    expect(result.owner).toBe("");
    expect(result.scope).toBe("exclusive");
    expect(result.type).toBe("write");
  });

  it("parses owner from lockinfo", () => {
    const body = `<?xml version="1.0"?>
      <lockinfo xmlns="DAV:">
        <lockscope><exclusive/></lockscope>
        <locktype><write/></locktype>
        <owner><href>user@example.com</href></owner>
      </lockinfo>`;
    const result = parseLockBody(body);
    expect(result.owner).toBe("user@example.com");
    expect(result.scope).toBe("exclusive");
  });
});
