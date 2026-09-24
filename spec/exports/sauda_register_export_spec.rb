require "rails_helper"

RSpec.describe SaudaRegisterExport do
  let(:company) { create(:company, name: "Howrah Textiles") }
  let(:seller) { create(:seller, name: "Ganges Rice Depot", brokerage_basis: "amount") }
  let(:buyer) { create(:buyer, name: "Salkia Retail Mart") }

  # A sauda worth 100,000 on the goods: 2,500 off, 97,500 taxable, 4,875 GST.
  def sauda_worth_100k(marks: 1, **attributes)
    sauda = build(:sauda, company: company, seller: seller, buyer: buyer, mark_count: 0,
                          discount_percent: 2.5, tax_invoice_no: "TI-2026-118",
                          bill_date: Date.new(2026, 9, 23), destination: "Siliguri",
                          **attributes)
    marks.times do
      mark = build(:sauda_mark, sauda: sauda, grade_count: 0,
                                mark: build(:mark, seller: seller))
      mark.sauda_grades << build(:sauda_grade, sauda_mark: mark, bags: 1, weight: 1,
                                               rate: 100_000.0 / marks)
      sauda.sauda_marks << mark
    end
    sauda.tap(&:save!)
  end

  def export(saudas, financial_year: nil)
    described_class.new(Array(saudas), company: company, seller: seller,
                                       financial_year: financial_year)
  end

  # Reads the sheet back out of the workbook, a row of cell values at a time.
  def sheet_rows(xlsx)
    Zip::File.open_buffer(StringIO.new(xlsx)) do |zip|
      document = Nokogiri::XML(zip.read("xl/worksheets/sheet1.xml"))
      return document.css("sheetData row").map { |row|
        row.css("c").map { |cell| cell.at_css("is > t, v")&.text.to_s }
      }
    end
  end

  describe "#to_xlsx" do
    it "heads the sheet with the company and the seller" do
      rows = sheet_rows(export(sauda_worth_100k).to_xlsx)

      expect(rows[0]).to eq(["Howrah Textiles"])
      expect(rows[1]).to eq(["Sauda register for Ganges Rice Depot"])
    end

    it "carries the register's columns" do
      rows = sheet_rows(export(sauda_worth_100k).to_xlsx)

      expect(rows[3]).to eq(
        ["Tax invoice no.", "Bill date", "Destination", "Buyer", "Mark", "Kg",
         "Total tax bill amt", "GST", "Discount", "Amount", "Brokerage"]
      )
    end

    # The four the register shows but the file is not asked to.
    it "leaves out the sauda date, the lot numbers, the grades and the bags" do
      rows = sheet_rows(export(sauda_worth_100k).to_xlsx)

      expect(rows[3]).not_to include("Date", "Lot no.", "Grade", "Bags")
    end

    it "writes a sauda's own figures once, on the first of its mark rows" do
      sauda = sauda_worth_100k(marks: 2)
      top, bottom = sauda.sauda_marks.map { |sauda_mark| sauda_mark.mark.name }

      rows = sheet_rows(export(sauda).to_xlsx)

      expect(rows[4]).to eq(
        ["TI-2026-118", "23 Sep 2026", "Siliguri", "Salkia Retail Mart", top, "1.0",
         "102375.0", "4875.0", "2500.0", "100000.0", "1000.0"]
      )
      # Only the mark's own two columns are filled in underneath.
      expect(rows[5]).to eq(["", "", "", "", bottom, "1.0", "", "", "", "", ""])
    end

    # Figures go in as numbers so the sheet can be summed once it is opened.
    it "puts the money in as numbers, not as text" do
      Zip::File.open_buffer(StringIO.new(export(sauda_worth_100k).to_xlsx)) do |zip|
        sheet = zip.read("xl/worksheets/sheet1.xml")
        expect(sheet).to include('t="n"><v>100000.0</v>')
      end
    end

    it "ends with the three totals the screen shows" do
      rows = sheet_rows(export([sauda_worth_100k, sauda_worth_100k]).to_xlsx)

      expect(rows.last)
        .to eq(["", "", "", "", "", "", "204750.0", "", "", "200000.0", "2000.0"])
    end

    # A sauda with two marks is two rows; it must still count once.
    it "does not count a sauda twice for having two marks" do
      rows = sheet_rows(export(sauda_worth_100k(marks: 2)).to_xlsx)

      expect(rows.last[9]).to eq("100000.0")
    end

    # rubyzip 3 marks every entry Zip64, and neither Excel nor LibreOffice will
    # open an .xlsx that claims it — the file reads as corrupt. The Gemfile pins
    # rubyzip back; this is the guard on that pin. The two bytes after the first
    # local header's signature are its "version needed to extract": 20 for a
    # plain zip, 45 for Zip64.
    it "zips the workbook so a spreadsheet will open it" do
      xlsx = export(sauda_worth_100k).to_xlsx

      expect(xlsx[0, 4]).to eq("PK\x03\x04".b)
      expect(xlsx[4, 2].unpack1("v")).to eq(20)
    end

    it "writes an empty register without falling over" do
      rows = sheet_rows(export([]).to_xlsx)

      expect(rows.last).to eq(["", "", "", "", "", "", "0", "", "", "0", "0"])
    end
  end

  describe "#to_pdf" do
    it "renders a PDF" do
      expect(export(sauda_worth_100k(marks: 2)).to_pdf).to start_with("%PDF")
    end

    it "renders an empty register without falling over" do
      expect(export([]).to_pdf).to start_with("%PDF")
    end
  end

  describe "#filename" do
    it "names the file after the seller and the day it was taken" do
      expect(export([]).filename(:xlsx))
        .to eq("sauda-register-ganges-rice-depot-#{Date.current.iso8601}.xlsx")
    end

    it "names it after the financial year when it covers one" do
      expect(export([], financial_year: "2025-2026").filename(:pdf))
        .to eq("sauda-register-ganges-rice-depot-2025-2026.pdf")
    end
  end

  # A page of one year's figures must not read as the seller's whole register.
  it "says which financial year it covers" do
    rows = sheet_rows(export(sauda_worth_100k, financial_year: "2025-2026").to_xlsx)

    expect(rows[1]).to eq(["Sauda register for Ganges Rice Depot, 2025-2026"])
  end

  # The PDF spells its figures out itself, so the grouping lives here.
  describe "the figures the PDF spells out" do
    it "groups rupees the Indian way" do
      expect(described_class.rupees(713_838.2)).to eq("7,13,838.20")
      expect(described_class.rupees(999)).to eq("999.00")
      expect(described_class.rupees(-1_234_567.891)).to eq("-12,34,567.89")
    end

    it "keeps kilos to three decimals and drops the trailing zeros" do
      expect(described_class.kilos(455.5)).to eq("455.5")
      expect(described_class.kilos(1234)).to eq("1,234")
      expect(described_class.kilos(25.125)).to eq("25.125")
    end
  end
end
