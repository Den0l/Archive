using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdateListingValidationRules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP TRIGGER IF EXISTS `TR_Images_BeforeInsert_Max10`;");
            migrationBuilder.Sql("DROP TRIGGER IF EXISTS `TR_Images_BeforeUpdate_Max10`;");

            migrationBuilder.AlterColumn<string>(
                name: "Title",
                table: "Listings",
                type: "varchar(120)",
                maxLength: 120,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "longtext")
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AlterColumn<string>(
                name: "Description",
                table: "Listings",
                type: "varchar(2000)",
                maxLength: 2000,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "longtext")
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Listings_Title_MinLength",
                table: "Listings",
                sql: "char_length(`Title`) >= 3");

            migrationBuilder.Sql(
                @"CREATE TRIGGER `TR_Images_BeforeInsert_Max10`
BEFORE INSERT ON `Images`
FOR EACH ROW
BEGIN
    IF ((SELECT COUNT(1) FROM `Images` WHERE `ListingId` = NEW.`ListingId`) >= 10) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Cannot upload more than 10 images for one listing.';
    END IF;
END;");

            migrationBuilder.Sql(
                @"CREATE TRIGGER `TR_Images_BeforeUpdate_Max10`
BEFORE UPDATE ON `Images`
FOR EACH ROW
BEGIN
    IF (NEW.`ListingId` <> OLD.`ListingId` AND
        (SELECT COUNT(1) FROM `Images` WHERE `ListingId` = NEW.`ListingId`) >= 10) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Cannot upload more than 10 images for one listing.';
    END IF;
END;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Listings_Title_MinLength",
                table: "Listings");

            migrationBuilder.Sql("DROP TRIGGER IF EXISTS `TR_Images_BeforeUpdate_Max10`;");
            migrationBuilder.Sql("DROP TRIGGER IF EXISTS `TR_Images_BeforeInsert_Max10`;");

            migrationBuilder.AlterColumn<string>(
                name: "Title",
                table: "Listings",
                type: "longtext",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "varchar(120)",
                oldMaxLength: 120)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.Sql(
                "UPDATE `Listings` SET `Description` = '' WHERE `Description` IS NULL;");

            migrationBuilder.AlterColumn<string>(
                name: "Description",
                table: "Listings",
                type: "longtext",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "varchar(2000)",
                oldMaxLength: 2000,
                oldNullable: true)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4");
        }
    }
}
