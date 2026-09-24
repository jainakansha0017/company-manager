# A seller's register as a file to hand on, as a spreadsheet or as a PDF.
#
# Both formats are laid out from the same COLUMNS list, so a column can never be
# on one and missing from the other.
class SaudaRegisterExport
  # One column of the register. `from` is handed the sauda and the mark on the
  # row. `level` says which of the two the column describes: a :sauda column is
  # written on the first of its mark rows and left blank under the rest, the way
  # the screen spans it, which also stops a multi-mark sauda being counted twice
  # in the totals.
  Column = Struct.new(:header, :level, :type, :from, :totalled)

  # The screen's columns less the four that were asked to be left out of the
  # file: the sauda date, the lot numbers, the grades and the bags.
  COLUMNS = [
    Column.new("Tax invoice no.", :sauda, :text, ->(sauda, _) { sauda.tax_invoice_no }),
    Column.new("Bill date", :sauda, :text, ->(sauda, _) { sauda.bill_date&.strftime("%d %b %Y") }),
    Column.new("Destination", :sauda, :text, ->(sauda, _) { sauda.destination }),
    Column.new("Buyer", :sauda, :text, ->(sauda, _) { sauda.buyer&.name }),
    Column.new("Mark", :mark, :text, ->(_, mark) { mark&.mark&.name }),
    Column.new("Kg", :mark, :kg, ->(_, mark) { mark&.total_kg }),
    Column.new("Total tax bill amt", :sauda, :money, ->(sauda, _) { sauda.total_tax_bill_amt }, true),
    Column.new("GST", :sauda, :money, ->(sauda, _) { sauda.gst_amt }),
    Column.new("Discount", :sauda, :money, ->(sauda, _) { sauda.disc_amt }),
    Column.new("Amount", :sauda, :money, ->(sauda, _) { sauda.amount }, true),
    Column.new("Brokerage", :sauda, :money, ->(sauda, _) { sauda.brokerage_amt }, true)
  ].freeze

  def initialize(saudas, company:, seller:, financial_year: nil)
    @saudas = saudas
    @company = company
    @seller = seller
    @financial_year = financial_year
  end

  # Named after the year it covers when it covers one, so a folder of these
  # does not need opening to tell them apart.
  def filename(extension)
    covers = financial_year ? financial_year.tr(" ", "") : Date.current.iso8601
    "sauda-register-#{seller.name.parameterize}-#{covers}.#{extension}"
  end

  def to_xlsx
    package = Axlsx::Package.new
    package.workbook.add_worksheet(name: "Sauda register") do |sheet|
      styles = xlsx_styles(package.workbook)

      sheet.add_row [company.name], style: styles[:title]
      sheet.add_row [subtitle]
      sheet.add_row []
      sheet.add_row COLUMNS.map(&:header), style: styles[:header]

      # Figures go in as numbers, not as text, so the sheet can be sorted and
      # summed once it is opened; the display format does the grouping.
      rows.each { |row| sheet.add_row row, style: styles[:body] }
      sheet.add_row totals_row, style: styles[:totals]

      sheet.column_widths(*COLUMNS.map { |column| column.type == :text ? 18 : 14 })
    end
    package.to_stream.read
  end

  def to_pdf
    pdf = Prawn::Document.new(page_size: "A4", page_layout: :landscape, margin: 24)

    pdf.text company.name, size: 14, style: :bold
    pdf.text subtitle, size: 10
    pdf.move_down 10

    pdf.table(pdf_rows, header: true, width: pdf.bounds.width,
                        cell_style: { size: 7, padding: [3, 4] }) do |table|
      table.row(0).font_style = :bold
      table.row(0).background_color = "EEEEEE"
      table.row(-1).font_style = :bold
      COLUMNS.each_index do |index|
        table.column(index).align = :right unless COLUMNS[index].type == :text
      end
    end

    pdf.render
  end

  private

  attr_reader :saudas, :company, :seller, :financial_year

  # Says which year the figures below cover, so a printed page is not mistaken
  # for the seller's whole register.
  def subtitle
    return "Sauda register for #{seller.name}" if financial_year.blank?

    "Sauda register for #{seller.name}, #{financial_year}"
  end

  # A row per mark, so a sauda with three marks is three rows deep, as on screen.
  # A sauda with no marks still gets its one row.
  def rows
    saudas.flat_map do |sauda|
      marks = sauda.sauda_marks.presence || [nil]
      marks.each_with_index.map do |mark, index|
        COLUMNS.map do |column|
          column.from.call(sauda, mark) unless column.level == :sauda && index.positive?
        end
      end
    end
  end

  def totals_row
    COLUMNS.map do |column|
      next unless column.totalled

      saudas.sum { |sauda| column.from.call(sauda, nil) || 0 }
    end
  end

  # Prawn takes strings, so every figure is formatted here rather than left to
  # the reader's spreadsheet.
  def pdf_rows
    body = rows.map { |row| row.each_with_index.map { |value, index| pdf_cell(value, COLUMNS[index]) } }
    totals = totals_row.each_with_index.map { |value, index| pdf_cell(value, COLUMNS[index]) }

    [COLUMNS.map(&:header)] + body + [totals]
  end

  def pdf_cell(value, column)
    return "" if value.nil?

    case column.type
    when :money then self.class.rupees(value)
    when :kg then self.class.kilos(value)
    else value.to_s
    end
  end

  def xlsx_styles(workbook)
    {
      title: workbook.styles.add_style(b: true, sz: 14),
      header: workbook.styles.add_style(b: true, bg_color: "EEEEEE"),
      body: body_formats(workbook),
      totals: body_formats(workbook, bold: true)
    }
  end

  # Excel's own Indian grouping, so 713838.2 reads 7,13,838.20 in the cell just
  # as it does on the screen.
  def body_formats(workbook, bold: false)
    COLUMNS.map do |column|
      format = case column.type
               when :money then "##,##,##0.00"
               when :kg then "##,##,##0.###"
               end
      workbook.styles.add_style(b: bold, format_code: format)
    end
  end

  class << self
    # 713838.2 -> "7,13,838.20": the last three digits, then twos, the way an
    # Indian bill groups them.
    def rupees(value)
      whole, fraction = format("%.2f", value).split(".")
      "#{group(whole)}.#{fraction}"
    end

    # Kilos carry up to three decimals and no trailing zeros: 455.5, not 455.500.
    def kilos(value)
      whole, fraction = format("%.3f", value).split(".")
      fraction = fraction.sub(/0+\z/, "")
      fraction.empty? ? group(whole) : "#{group(whole)}.#{fraction}"
    end

    private

    def group(whole)
      sign = whole.delete_prefix("-")
      return whole if sign.length <= 3

      lead = sign[0..-4].reverse.scan(/\d{1,2}/).join(",").reverse
      "#{whole.start_with?("-") ? "-" : ""}#{lead},#{sign[-3..]}"
    end
  end
end
