// PDF layout for the Sales Report export, built with @react-pdf/renderer
// components (no headless browser — see route.js for why Puppeteer was
// swapped out). Pure presentation; all the filtering/summary math happens
// client-side in admin_dashboard.html before this ever runs.
import { readFileSync } from "fs";
import { join } from "path";
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";

// Embedded directly (not fetched by URL) so the PDF doesn't depend on a
// network round-trip to render the logo — this file only ever runs
// server-side (imported by route.js), so reading from disk is safe here.
const LOGO_SRC = readFileSync(join(process.cwd(), "public/image/logo.png"));

const STATUS_LABELS = {
  pending: "Processing",
  shipped: "Shipped",
  in_transit: "In Transit",
  cancelled: "Cancelled",
};

const styles = StyleSheet.create({
  page: { padding: "24pt 36pt", fontFamily: "Helvetica", fontSize: 10, color: "#1a1a1a" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "#A67C27",
    paddingBottom: 12,
    marginBottom: 18,
  },
  brand: { flexDirection: "row", alignItems: "center" },
  logo: { width: 34, height: 34, borderRadius: 17, marginRight: 8 },
  brandName: { fontSize: 15, fontWeight: 700, color: "#A67C27", letterSpacing: 1 },
  headerMeta: { fontSize: 9, color: "#555" },
  title: { fontSize: 18, marginBottom: 4 },
  period: { fontSize: 11, color: "#555", marginBottom: 18 },
  summaryRow: { flexDirection: "row", marginBottom: 20 },
  summaryCard: {
    flex: 1,
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#e5e2e1",
    borderRadius: 4,
    padding: "10pt 12pt",
    backgroundColor: "#fbf9f5",
  },
  summaryLabel: { fontSize: 8, textTransform: "uppercase", letterSpacing: 1, color: "#8a7f6a", marginBottom: 5 },
  summaryValue: { fontSize: 15, fontWeight: 700, color: "#a67c27" },
  table: { marginBottom: 16 },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: "#1a1a1a",
    paddingBottom: 6,
    marginBottom: 2,
  },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#eeeeee", paddingVertical: 6 },
  th: { fontSize: 8, textTransform: "uppercase", letterSpacing: 0.5, color: "#8a7f6a" },
  td: { fontSize: 9.5 },
  // colId has no spaces to wrap on ("GBA-2026-100201"), so it needs to be
  // wide enough to fit that whole token — otherwise it overflows into the
  // next column instead of wrapping. colProduct wrapping to a second line
  // for a long multi-item order is fine; a single run-on ID isn't.
  colId: { width: "20%", paddingRight: 6 },
  colDate: { width: "12%" },
  colCustomer: { width: "16%" },
  colProduct: { width: "22%" },
  colAmount: { width: "18%", textAlign: "right", paddingRight: 8 },
  colStatus: { width: "12%" },
  emptyRow: { textAlign: "center", color: "#999999", padding: 16, fontSize: 10 },
  totalsRow: {
    flexDirection: "row",
    borderTopWidth: 2,
    borderTopColor: "#1a1a1a",
    paddingTop: 8,
    justifyContent: "flex-end",
  },
  totalsLabel: { fontSize: 11, fontWeight: 700 },
  footerNote: { fontSize: 8, color: "#999999", marginTop: 16 },
  pageFooter: { position: "absolute", bottom: 16, left: 0, right: 0, textAlign: "center", fontSize: 8, color: "#999999" },
});

function fmtRM(n) {
  return "RM " + Number(n || 0).toLocaleString("en-MY", { minimumFractionDigits: 2 });
}

function fmtGeneratedAt(iso) {
  const d = iso ? new Date(iso) : new Date();
  return (
    d.toLocaleDateString("en-MY", { year: "numeric", month: "long", day: "numeric" }) +
    " at " +
    d.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  );
}

export default function SalesReportDocument({ periodLabel, generatedAt, totals, orders }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <Image src={LOGO_SRC} style={styles.logo} />
            <Text style={styles.brandName}>GB ASSET</Text>
          </View>
          <Text style={styles.headerMeta}>Generated {fmtGeneratedAt(generatedAt)}</Text>
        </View>

        <Text style={styles.title}>Sales Report</Text>
        <Text style={styles.period}>Period: {periodLabel}</Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Revenue</Text>
            <Text style={styles.summaryValue}>{fmtRM(totals.revenue)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Orders</Text>
            <Text style={styles.summaryValue}>{Number(totals.orders || 0).toLocaleString("en-MY")}</Text>
          </View>
          <View style={[styles.summaryCard, { marginRight: 0 }]}>
            <Text style={styles.summaryLabel}>Products Sold</Text>
            <Text style={styles.summaryValue}>{Number(totals.productsSold || 0).toLocaleString("en-MY")}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow} fixed>
            <Text style={[styles.th, styles.colId]}>Order ID</Text>
            <Text style={[styles.th, styles.colDate]}>Date</Text>
            <Text style={[styles.th, styles.colCustomer]}>Customer</Text>
            <Text style={[styles.th, styles.colProduct]}>Product</Text>
            <Text style={[styles.th, styles.colAmount]}>Amount (RM)</Text>
            <Text style={[styles.th, styles.colStatus]}>Status</Text>
          </View>
          {orders.length === 0 ? (
            <Text style={styles.emptyRow}>No orders in this period.</Text>
          ) : (
            orders.map((o) => (
              <View style={styles.tableRow} key={o.id} wrap={false}>
                <Text style={[styles.td, styles.colId]}>{o.id}</Text>
                <Text style={[styles.td, styles.colDate]}>{o.date}</Text>
                <Text style={[styles.td, styles.colCustomer]}>{o.customer}</Text>
                <Text style={[styles.td, styles.colProduct]}>{o.product}</Text>
                <Text style={[styles.td, styles.colAmount]}>{fmtRM(o.amount)}</Text>
                <Text style={[styles.td, styles.colStatus]}>{STATUS_LABELS[o.status] || o.status}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Grand Total: {fmtRM(totals.revenue)}</Text>
        </View>

        <Text style={styles.footerNote}>
          GB Asset — Institutional Vault Dashboard. This report reflects data at the time it was generated.
        </Text>

        <Text style={styles.pageFooter} fixed render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </Page>
    </Document>
  );
}
