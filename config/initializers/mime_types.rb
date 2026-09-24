# Rails knows :pdf out of the box but not :xlsx, and the sauda register
# downloads as both.
Mime::Type.register "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", :xlsx
