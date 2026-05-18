-- Schema-only script: creates tables, constraints, and indexes.
-- Does not create database/users and does not grant privileges.

CREATE TABLE `AspNetRoles` (
    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
    `Name` varchar(256) CHARACTER SET utf8mb4 NULL,
    `NormalizedName` varchar(256) CHARACTER SET utf8mb4 NULL,
    `ConcurrencyStamp` longtext CHARACTER SET utf8mb4 NULL,
    CONSTRAINT `PK_AspNetRoles` PRIMARY KEY (`Id`)
) CHARACTER SET=utf8mb4;


CREATE TABLE `AspNetUsers` (
    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
    `Nickname` longtext CHARACTER SET utf8mb4 NOT NULL,
    `NormalizedNickname` varchar(50) CHARACTER SET utf8mb4 NULL,
    `LastLoggedIn` datetime(6) NOT NULL,
    `PendingEmail` varchar(254) CHARACTER SET utf8mb4 NULL,
    `PendingEmailRequestedAt` datetime(6) NULL,
    `NotifyEmailOnNewMessage` tinyint(1) NOT NULL DEFAULT TRUE,
    `NotifyEmailOnSellerOrder` tinyint(1) NOT NULL DEFAULT TRUE,
    `NotifyEmailOnFollowedSellerListing` tinyint(1) NOT NULL DEFAULT TRUE,
    `NotifyEmailOnLogin` tinyint(1) NOT NULL DEFAULT TRUE,
    `MustChangePassword` tinyint(1) NOT NULL DEFAULT FALSE,
    `UserName` varchar(256) CHARACTER SET utf8mb4 NULL,
    `NormalizedUserName` varchar(256) CHARACTER SET utf8mb4 NULL,
    `Email` varchar(256) CHARACTER SET utf8mb4 NULL,
    `NormalizedEmail` varchar(256) CHARACTER SET utf8mb4 NULL,
    `EmailConfirmed` tinyint(1) NOT NULL,
    `PasswordHash` longtext CHARACTER SET utf8mb4 NULL,
    `SecurityStamp` longtext CHARACTER SET utf8mb4 NULL,
    `ConcurrencyStamp` longtext CHARACTER SET utf8mb4 NULL,
    `PhoneNumber` longtext CHARACTER SET utf8mb4 NULL,
    `PhoneNumberConfirmed` tinyint(1) NOT NULL,
    `TwoFactorEnabled` tinyint(1) NOT NULL,
    `LockoutEnd` datetime(6) NULL,
    `LockoutEnabled` tinyint(1) NOT NULL,
    `AccessFailedCount` int NOT NULL,
    CONSTRAINT `PK_AspNetUsers` PRIMARY KEY (`Id`)
) CHARACTER SET=utf8mb4;


CREATE TABLE `Categories` (
    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
    `Name` longtext CHARACTER SET utf8mb4 NOT NULL,
    `ParentCategoryId` char(36) COLLATE ascii_general_ci NULL,
    CONSTRAINT `PK_Categories` PRIMARY KEY (`Id`),
    CONSTRAINT `FK_Categories_Categories_ParentCategoryId` FOREIGN KEY (`ParentCategoryId`) REFERENCES `Categories` (`Id`)
) CHARACTER SET=utf8mb4;


CREATE TABLE `Cities` (
    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
    `Name` longtext CHARACTER SET utf8mb4 NOT NULL,
    `ZipCode` longtext CHARACTER SET utf8mb4 NOT NULL,
    `District` longtext CHARACTER SET utf8mb4 NOT NULL,
    `Region` longtext CHARACTER SET utf8mb4 NOT NULL,
    `Location` point srid 4326 NOT NULL,
    CONSTRAINT `PK_Cities` PRIMARY KEY (`Id`)
) CHARACTER SET=utf8mb4;


CREATE TABLE `Conversations` (
    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
    `LastUpdatedAt` datetime(6) NOT NULL,
    `CreatedAt` datetime(6) NOT NULL,
    CONSTRAINT `PK_Conversations` PRIMARY KEY (`Id`)
) CHARACTER SET=utf8mb4;


CREATE TABLE `ListingProperties` (
    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
    `Name` longtext CHARACTER SET utf8mb4 NOT NULL,
    CONSTRAINT `PK_ListingProperties` PRIMARY KEY (`Id`)
) CHARACTER SET=utf8mb4;


CREATE TABLE `StateOfItem` (
    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
    `Name` longtext CHARACTER SET utf8mb4 NOT NULL,
    CONSTRAINT `PK_StateOfItem` PRIMARY KEY (`Id`)
) CHARACTER SET=utf8mb4;


CREATE TABLE `AspNetRoleClaims` (
    `Id` int NOT NULL AUTO_INCREMENT,
    `RoleId` char(36) COLLATE ascii_general_ci NOT NULL,
    `ClaimType` longtext CHARACTER SET utf8mb4 NULL,
    `ClaimValue` longtext CHARACTER SET utf8mb4 NULL,
    CONSTRAINT `PK_AspNetRoleClaims` PRIMARY KEY (`Id`),
    CONSTRAINT `FK_AspNetRoleClaims_AspNetRoles_RoleId` FOREIGN KEY (`RoleId`) REFERENCES `AspNetRoles` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;


CREATE TABLE `AspNetUserClaims` (
    `Id` int NOT NULL AUTO_INCREMENT,
    `UserId` char(36) COLLATE ascii_general_ci NOT NULL,
    `ClaimType` longtext CHARACTER SET utf8mb4 NULL,
    `ClaimValue` longtext CHARACTER SET utf8mb4 NULL,
    CONSTRAINT `PK_AspNetUserClaims` PRIMARY KEY (`Id`),
    CONSTRAINT `FK_AspNetUserClaims_AspNetUsers_UserId` FOREIGN KEY (`UserId`) REFERENCES `AspNetUsers` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;


CREATE TABLE `AspNetUserLogins` (
    `LoginProvider` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
    `ProviderKey` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
    `ProviderDisplayName` longtext CHARACTER SET utf8mb4 NULL,
    `UserId` char(36) COLLATE ascii_general_ci NOT NULL,
    CONSTRAINT `PK_AspNetUserLogins` PRIMARY KEY (`LoginProvider`, `ProviderKey`),
    CONSTRAINT `FK_AspNetUserLogins_AspNetUsers_UserId` FOREIGN KEY (`UserId`) REFERENCES `AspNetUsers` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;


CREATE TABLE `AspNetUserRoles` (
    `UserId` char(36) COLLATE ascii_general_ci NOT NULL,
    `RoleId` char(36) COLLATE ascii_general_ci NOT NULL,
    CONSTRAINT `PK_AspNetUserRoles` PRIMARY KEY (`UserId`, `RoleId`),
    CONSTRAINT `FK_AspNetUserRoles_AspNetRoles_RoleId` FOREIGN KEY (`RoleId`) REFERENCES `AspNetRoles` (`Id`) ON DELETE CASCADE,
    CONSTRAINT `FK_AspNetUserRoles_AspNetUsers_UserId` FOREIGN KEY (`UserId`) REFERENCES `AspNetUsers` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;


CREATE TABLE `AspNetUserTokens` (
    `UserId` char(36) COLLATE ascii_general_ci NOT NULL,
    `LoginProvider` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
    `Name` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
    `Value` longtext CHARACTER SET utf8mb4 NULL,
    CONSTRAINT `PK_AspNetUserTokens` PRIMARY KEY (`UserId`, `LoginProvider`, `Name`),
    CONSTRAINT `FK_AspNetUserTokens_AspNetUsers_UserId` FOREIGN KEY (`UserId`) REFERENCES `AspNetUsers` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;


CREATE TABLE `Reviews` (
    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
    `ReviewerId` char(36) COLLATE ascii_general_ci NOT NULL,
    `RevieweeId` char(36) COLLATE ascii_general_ci NOT NULL,
    `ReviewText` longtext CHARACTER SET utf8mb4 NOT NULL,
    `CreatedAt` datetime(6) NOT NULL,
    CONSTRAINT `PK_Reviews` PRIMARY KEY (`Id`),
    CONSTRAINT `FK_Reviews_AspNetUsers_RevieweeId` FOREIGN KEY (`RevieweeId`) REFERENCES `AspNetUsers` (`Id`) ON DELETE CASCADE,
    CONSTRAINT `FK_Reviews_AspNetUsers_ReviewerId` FOREIGN KEY (`ReviewerId`) REFERENCES `AspNetUsers` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;


CREATE TABLE `SellerSubscriptions` (
    `SubscriberId` char(36) COLLATE ascii_general_ci NOT NULL,
    `SellerId` char(36) COLLATE ascii_general_ci NOT NULL,
    `CreatedAt` datetime(6) NOT NULL,
    CONSTRAINT `PK_SellerSubscriptions` PRIMARY KEY (`SubscriberId`, `SellerId`),
    CONSTRAINT `FK_SellerSubscriptions_AspNetUsers_SellerId` FOREIGN KEY (`SellerId`) REFERENCES `AspNetUsers` (`Id`) ON DELETE CASCADE,
    CONSTRAINT `FK_SellerSubscriptions_AspNetUsers_SubscriberId` FOREIGN KEY (`SubscriberId`) REFERENCES `AspNetUsers` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;


CREATE TABLE `ConversationParticipant` (
    `ConversationId` char(36) COLLATE ascii_general_ci NOT NULL,
    `UserId` char(36) COLLATE ascii_general_ci NOT NULL,
    CONSTRAINT `PK_ConversationParticipant` PRIMARY KEY (`ConversationId`, `UserId`),
    CONSTRAINT `FK_ConversationParticipant_AspNetUsers_UserId` FOREIGN KEY (`UserId`) REFERENCES `AspNetUsers` (`Id`) ON DELETE CASCADE,
    CONSTRAINT `FK_ConversationParticipant_Conversations_ConversationId` FOREIGN KEY (`ConversationId`) REFERENCES `Conversations` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;


CREATE TABLE `Messages` (
    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
    `ConversationId` char(36) COLLATE ascii_general_ci NOT NULL,
    `SenderId` char(36) COLLATE ascii_general_ci NOT NULL,
    `Content` longtext CHARACTER SET utf8mb4 NOT NULL,
    `CreatedAt` datetime(6) NOT NULL,
    CONSTRAINT `PK_Messages` PRIMARY KEY (`Id`),
    CONSTRAINT `FK_Messages_AspNetUsers_SenderId` FOREIGN KEY (`SenderId`) REFERENCES `AspNetUsers` (`Id`) ON DELETE CASCADE,
    CONSTRAINT `FK_Messages_Conversations_ConversationId` FOREIGN KEY (`ConversationId`) REFERENCES `Conversations` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;


CREATE TABLE `CategoryListingProperty` (
    `CategoriesId` char(36) COLLATE ascii_general_ci NOT NULL,
    `ListingPropertiesId` char(36) COLLATE ascii_general_ci NOT NULL,
    CONSTRAINT `PK_CategoryListingProperty` PRIMARY KEY (`CategoriesId`, `ListingPropertiesId`),
    CONSTRAINT `FK_CategoryListingProperty_Categories_CategoriesId` FOREIGN KEY (`CategoriesId`) REFERENCES `Categories` (`Id`) ON DELETE CASCADE,
    CONSTRAINT `FK_CategoryListingProperty_ListingProperties_ListingPropertiesId` FOREIGN KEY (`ListingPropertiesId`) REFERENCES `ListingProperties` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;


CREATE TABLE `ListingPropertyValues` (
    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
    `Name` longtext CHARACTER SET utf8mb4 NOT NULL,
    `ListingPropertyId` char(36) COLLATE ascii_general_ci NOT NULL,
    CONSTRAINT `PK_ListingPropertyValues` PRIMARY KEY (`Id`),
    CONSTRAINT `FK_ListingPropertyValues_ListingProperties_ListingPropertyId` FOREIGN KEY (`ListingPropertyId`) REFERENCES `ListingProperties` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;


CREATE TABLE `Listings` (
    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
    `Price` decimal(65,30) NOT NULL,
    `SellerId` char(36) COLLATE ascii_general_ci NOT NULL,
    `StateOfItemId` char(36) COLLATE ascii_general_ci NOT NULL,
    `Title` varchar(120) CHARACTER SET utf8mb4 NOT NULL,
    `Description` varchar(2000) CHARACTER SET utf8mb4 NULL,
    `IsSold` tinyint(1) NOT NULL,
    `IsArchived` tinyint(1) NOT NULL,
    `CreatedAt` datetime(6) NOT NULL,
    `CityId` char(36) COLLATE ascii_general_ci NOT NULL,
    `CategoryId` char(36) COLLATE ascii_general_ci NOT NULL,
    `ViewCount` int NOT NULL,
    CONSTRAINT `PK_Listings` PRIMARY KEY (`Id`),
    CONSTRAINT `CK_Listings_Title_MinLength` CHECK (char_length(`Title`) >= 3),
    CONSTRAINT `FK_Listings_AspNetUsers_SellerId` FOREIGN KEY (`SellerId`) REFERENCES `AspNetUsers` (`Id`) ON DELETE CASCADE,
    CONSTRAINT `FK_Listings_Categories_CategoryId` FOREIGN KEY (`CategoryId`) REFERENCES `Categories` (`Id`) ON DELETE CASCADE,
    CONSTRAINT `FK_Listings_Cities_CityId` FOREIGN KEY (`CityId`) REFERENCES `Cities` (`Id`) ON DELETE CASCADE,
    CONSTRAINT `FK_Listings_StateOfItem_StateOfItemId` FOREIGN KEY (`StateOfItemId`) REFERENCES `StateOfItem` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;


CREATE TABLE `CartItems` (
    `UserId` char(36) COLLATE ascii_general_ci NOT NULL,
    `ListingId` char(36) COLLATE ascii_general_ci NOT NULL,
    `Quantity` int NOT NULL,
    `CreatedAt` datetime(6) NOT NULL,
    CONSTRAINT `PK_CartItems` PRIMARY KEY (`UserId`, `ListingId`),
    CONSTRAINT `FK_CartItems_AspNetUsers_UserId` FOREIGN KEY (`UserId`) REFERENCES `AspNetUsers` (`Id`) ON DELETE CASCADE,
    CONSTRAINT `FK_CartItems_Listings_ListingId` FOREIGN KEY (`ListingId`) REFERENCES `Listings` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;


CREATE TABLE `FavoriteItems` (
    `UserId` char(36) COLLATE ascii_general_ci NOT NULL,
    `ListingId` char(36) COLLATE ascii_general_ci NOT NULL,
    `CreatedAt` datetime(6) NOT NULL,
    CONSTRAINT `PK_FavoriteItems` PRIMARY KEY (`UserId`, `ListingId`),
    CONSTRAINT `FK_FavoriteItems_AspNetUsers_UserId` FOREIGN KEY (`UserId`) REFERENCES `AspNetUsers` (`Id`) ON DELETE CASCADE,
    CONSTRAINT `FK_FavoriteItems_Listings_ListingId` FOREIGN KEY (`ListingId`) REFERENCES `Listings` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;


CREATE TABLE `Images` (
    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
    `ImageUrl` longtext CHARACTER SET utf8mb4 NOT NULL,
    `FileName` longtext CHARACTER SET utf8mb4 NOT NULL,
    `FileExtension` longtext CHARACTER SET utf8mb4 NOT NULL,
    `FileSizeInBytes` bigint NOT NULL,
    `ListingId` char(36) COLLATE ascii_general_ci NOT NULL,
    CONSTRAINT `PK_Images` PRIMARY KEY (`Id`),
    CONSTRAINT `FK_Images_Listings_ListingId` FOREIGN KEY (`ListingId`) REFERENCES `Listings` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;


CREATE TABLE `ListingGuestViews` (
    `ListingId` char(36) COLLATE ascii_general_ci NOT NULL,
    `ViewerFingerprint` varchar(64) CHARACTER SET utf8mb4 NOT NULL,
    `ViewedAt` datetime(6) NOT NULL,
    CONSTRAINT `PK_ListingGuestViews` PRIMARY KEY (`ListingId`, `ViewerFingerprint`),
    CONSTRAINT `FK_ListingGuestViews_Listings_ListingId` FOREIGN KEY (`ListingId`) REFERENCES `Listings` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;


CREATE TABLE `ListingListingPropertyValue` (
    `ListingsId` char(36) COLLATE ascii_general_ci NOT NULL,
    `SelectedListingPropertyValuesId` char(36) COLLATE ascii_general_ci NOT NULL,
    CONSTRAINT `PK_ListingListingPropertyValue` PRIMARY KEY (`ListingsId`, `SelectedListingPropertyValuesId`),
    CONSTRAINT `FK_ListingListingPropertyValue_ListingPropertyValues_SelectedLi~` FOREIGN KEY (`SelectedListingPropertyValuesId`) REFERENCES `ListingPropertyValues` (`Id`) ON DELETE CASCADE,
    CONSTRAINT `FK_ListingListingPropertyValue_Listings_ListingsId` FOREIGN KEY (`ListingsId`) REFERENCES `Listings` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;


CREATE TABLE `ListingViews` (
    `ListingId` char(36) COLLATE ascii_general_ci NOT NULL,
    `ViewerId` char(36) COLLATE ascii_general_ci NOT NULL,
    `ViewedAt` datetime(6) NOT NULL,
    CONSTRAINT `PK_ListingViews` PRIMARY KEY (`ListingId`, `ViewerId`),
    CONSTRAINT `FK_ListingViews_AspNetUsers_ViewerId` FOREIGN KEY (`ViewerId`) REFERENCES `AspNetUsers` (`Id`) ON DELETE CASCADE,
    CONSTRAINT `FK_ListingViews_Listings_ListingId` FOREIGN KEY (`ListingId`) REFERENCES `Listings` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;


CREATE TABLE `Orders` (
    `Id` char(36) COLLATE ascii_general_ci NOT NULL,
    `ListingId` char(36) COLLATE ascii_general_ci NOT NULL,
    `BuyerId` char(36) COLLATE ascii_general_ci NOT NULL,
    `SellerId` char(36) COLLATE ascii_general_ci NOT NULL,
    `ConversationId` char(36) COLLATE ascii_general_ci NOT NULL,
    `Status` int NOT NULL,
    `CreatedAt` datetime(6) NOT NULL,
    `CancelledAt` datetime(6) NULL,
    CONSTRAINT `PK_Orders` PRIMARY KEY (`Id`),
    CONSTRAINT `FK_Orders_AspNetUsers_BuyerId` FOREIGN KEY (`BuyerId`) REFERENCES `AspNetUsers` (`Id`) ON DELETE CASCADE,
    CONSTRAINT `FK_Orders_AspNetUsers_SellerId` FOREIGN KEY (`SellerId`) REFERENCES `AspNetUsers` (`Id`) ON DELETE CASCADE,
    CONSTRAINT `FK_Orders_Listings_ListingId` FOREIGN KEY (`ListingId`) REFERENCES `Listings` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;


CREATE INDEX `IX_AspNetRoleClaims_RoleId` ON `AspNetRoleClaims` (`RoleId`);


CREATE UNIQUE INDEX `RoleNameIndex` ON `AspNetRoles` (`NormalizedName`);


CREATE INDEX `IX_AspNetUserClaims_UserId` ON `AspNetUserClaims` (`UserId`);


CREATE INDEX `IX_AspNetUserLogins_UserId` ON `AspNetUserLogins` (`UserId`);


CREATE INDEX `IX_AspNetUserRoles_RoleId` ON `AspNetUserRoles` (`RoleId`);


CREATE INDEX `EmailIndex` ON `AspNetUsers` (`NormalizedEmail`);


CREATE UNIQUE INDEX `IX_AspNetUsers_NormalizedNickname` ON `AspNetUsers` (`NormalizedNickname`);


CREATE UNIQUE INDEX `UserNameIndex` ON `AspNetUsers` (`NormalizedUserName`);


CREATE INDEX `IX_CartItems_ListingId` ON `CartItems` (`ListingId`);


CREATE INDEX `IX_Categories_ParentCategoryId` ON `Categories` (`ParentCategoryId`);


CREATE INDEX `IX_CategoryListingProperty_ListingPropertiesId` ON `CategoryListingProperty` (`ListingPropertiesId`);


CREATE INDEX `IX_ConversationParticipant_UserId` ON `ConversationParticipant` (`UserId`);


CREATE INDEX `IX_FavoriteItems_ListingId` ON `FavoriteItems` (`ListingId`);


CREATE INDEX `IX_Images_ListingId` ON `Images` (`ListingId`);


CREATE INDEX `IX_ListingListingPropertyValue_SelectedListingPropertyValuesId` ON `ListingListingPropertyValue` (`SelectedListingPropertyValuesId`);


CREATE INDEX `IX_ListingPropertyValues_ListingPropertyId` ON `ListingPropertyValues` (`ListingPropertyId`);


CREATE INDEX `IX_Listings_CategoryId` ON `Listings` (`CategoryId`);


CREATE INDEX `IX_Listings_CityId` ON `Listings` (`CityId`);


CREATE INDEX `IX_Listings_SellerId` ON `Listings` (`SellerId`);


CREATE INDEX `IX_Listings_StateOfItemId` ON `Listings` (`StateOfItemId`);


CREATE INDEX `IX_ListingViews_ViewerId` ON `ListingViews` (`ViewerId`);


CREATE INDEX `IX_Messages_ConversationId` ON `Messages` (`ConversationId`);


CREATE INDEX `IX_Messages_SenderId` ON `Messages` (`SenderId`);


CREATE INDEX `IX_Orders_BuyerId` ON `Orders` (`BuyerId`);


CREATE INDEX `IX_Orders_ListingId` ON `Orders` (`ListingId`);


CREATE INDEX `IX_Orders_SellerId` ON `Orders` (`SellerId`);


CREATE INDEX `IX_Reviews_RevieweeId` ON `Reviews` (`RevieweeId`);


CREATE INDEX `IX_Reviews_ReviewerId` ON `Reviews` (`ReviewerId`);


CREATE INDEX `IX_SellerSubscriptions_SellerId` ON `SellerSubscriptions` (`SellerId`);


